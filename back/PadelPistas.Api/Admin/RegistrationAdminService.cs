using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Data;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>Inscripciones respaldadas por EF Core (ver <see cref="IRegistrationAdminService"/>).</summary>
public sealed class RegistrationAdminService(PadelPistasDbContext db) : IRegistrationAdminService
{
    public async Task<IReadOnlyList<RegistrationResponse>?> GetForCategoryAsync(int categoryId, CancellationToken ct = default)
    {
        var existe = await db.Categories.AnyAsync(c => c.Id == categoryId, ct);
        if (!existe) return null;

        var inscripciones = await db.Registrations
            .Where(r => r.CategoryId == categoryId)
            .Include(r => r.Player1).Include(r => r.Player2)
            .OrderBy(r => r.Id)
            .ToListAsync(ct);
        return inscripciones.Select(r => r.ToResponse()).ToList();
    }

    public async Task<RegistrationResult> CreateAsync(int categoryId, CreateRegistrationRequest request, CancellationToken ct = default)
    {
        var categoria = await db.Categories.FindAsync([categoryId], ct);
        if (categoria is null) return new(null, AdminErrorKind.NotFound);

        // Los jugadores nuevos necesitan id antes de poder ordenar la pareja
        // (convención Player1Id < Player2Id), así que hay dos SaveChanges; la
        // transacción evita dejar jugadores huérfanos si la inscripción falla.
        await using var transaccion = await db.Database.BeginTransactionAsync(ct);

        var (jugador1, error1) = await ResolverJugadorAsync(request.Jugador1!, ct);
        if (error1 is not null) return new(null, AdminErrorKind.Invalid, error1);
        var (jugador2, error2) = await ResolverJugadorAsync(request.Jugador2!, ct);
        if (error2 is not null) return new(null, AdminErrorKind.Invalid, error2);

        await db.SaveChangesAsync(ct);

        if (jugador1!.Id == jugador2!.Id)
            return new(null, AdminErrorKind.Invalid, "Los dos jugadores de la pareja deben ser distintos.");

        var (menor, mayor) = jugador1.Id < jugador2.Id ? (jugador1, jugador2) : (jugador2, jugador1);

        var duplicada = await db.Registrations.AnyAsync(
            r => r.CategoryId == categoryId && r.Player1Id == menor.Id && r.Player2Id == mayor.Id, ct);
        if (duplicada)
            return new(null, AdminErrorKind.Duplicate, "La pareja ya está inscrita en esta categoría.");

        var inscripcion = new Registration
        {
            CategoryId = categoryId,
            Player1Id = menor.Id,
            Player1 = menor,
            Player2Id = mayor.Id,
            Player2 = mayor,
        };
        db.Registrations.Add(inscripcion);
        await db.SaveChangesAsync(ct);
        await transaccion.CommitAsync(ct);

        return new(inscripcion.ToResponse());
    }

    public async Task<bool> UpdateStatusAsync(int id, RegistrationStatus estado, CancellationToken ct = default)
    {
        var inscripcion = await db.Registrations.FindAsync([id], ct);
        if (inscripcion is null) return false;

        inscripcion.Estado = estado;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> UpdatePaymentAsync(int id, bool pagada, CancellationToken ct = default)
    {
        var inscripcion = await db.Registrations.FindAsync([id], ct);
        if (inscripcion is null) return false;

        inscripcion.Pagada = pagada;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(bool Found, string? Error)> UpdateAvailabilityAsync(int id, List<AvailabilitySlotDto> slots, CancellationToken ct = default)
    {
        var inscripcion = await db.Registrations
            .Include(r => r.Category!).ThenInclude(c => c.Tournament)
            .SingleOrDefaultAsync(r => r.Id == id, ct);
        if (inscripcion is null) return (false, null);

        var torneo = inscripcion.Category!.Tournament!;
        foreach (var slot in slots)
        {
            if (slot.Hora is < 0 or > 23)
                return (true, $"La hora {slot.Hora} no es válida (0–23).");
            if (slot.Fecha < torneo.FechaInicio || slot.Fecha > torneo.FechaFin)
                return (true, $"El día {slot.Fecha:yyyy-MM-dd} está fuera de las fechas del torneo.");
        }

        inscripcion.Disponibilidad = slots
            .Distinct()
            .OrderBy(s => s.Fecha).ThenBy(s => s.Hora)
            .Select(s => new AvailabilitySlot(s.Fecha, s.Hora))
            .ToList();
        await db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var inscripcion = await db.Registrations.FindAsync([id], ct);
        if (inscripcion is null) return false;

        // El cascade arrastra sus partidos; para retirar una pareja conservando
        // el histórico está el estado "retirada".
        db.Registrations.Remove(inscripcion);
        await db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>Devuelve el jugador existente (por id) o deja uno nuevo pendiente de guardar.</summary>
    private async Task<(Player? Jugador, string? Error)> ResolverJugadorAsync(RegistrationPlayerRef referencia, CancellationToken ct)
    {
        if (referencia.Id is { } id)
        {
            var existente = await db.Players.FindAsync([id], ct);
            return existente is null ? (null, $"El jugador {id} no existe.") : (existente, null);
        }

        if (string.IsNullOrWhiteSpace(referencia.Nombre))
            return (null, "Cada jugador necesita un id existente o un nombre para crearlo.");

        var nuevo = new Player
        {
            Nombre = referencia.Nombre.Trim(),
            Telefonos = PlayerAdminService.NormalizarTelefonos(referencia.Telefonos),
        };
        db.Players.Add(nuevo);
        return (nuevo, null);
    }
}
