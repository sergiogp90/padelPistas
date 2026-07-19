using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Data;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>Jugadores respaldados por EF Core (ver <see cref="IPlayerAdminService"/>).</summary>
public sealed class PlayerAdminService(PadelPistasDbContext db) : IPlayerAdminService
{
    public async Task<IReadOnlyList<PlayerResponse>> SearchAsync(string? search, CancellationToken ct = default)
    {
        var query = db.Players.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            // Nombre o cualquier teléfono. Telefonos es una colección primitiva
            // (JSON): EF traduce el Any a una subconsulta json_each en SQLite.
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.Nombre.ToLower().Contains(term) || p.Telefonos.Any(t => t.Contains(term)));
        }

        var jugadores = await query.OrderBy(p => p.Nombre).ThenBy(p => p.Id).ToListAsync(ct);
        return jugadores.Select(p => p.ToResponse()).ToList();
    }

    public async Task<PlayerResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var jugador = await db.Players.FindAsync([id], ct);
        return jugador?.ToResponse();
    }

    public async Task<PlayerResponse> CreateAsync(SavePlayerRequest request, CancellationToken ct = default)
    {
        var jugador = new Player
        {
            Nombre = request.Nombre.Trim(),
            Telefonos = NormalizarTelefonos(request.Telefonos),
        };
        db.Players.Add(jugador);
        await db.SaveChangesAsync(ct);
        return jugador.ToResponse();
    }

    public async Task<bool> UpdateAsync(int id, SavePlayerRequest request, CancellationToken ct = default)
    {
        var jugador = await db.Players.FindAsync([id], ct);
        if (jugador is null) return false;

        jugador.Nombre = request.Nombre.Trim();
        jugador.Telefonos = NormalizarTelefonos(request.Telefonos);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<PlayerDeleteResult> DeleteAsync(int id, CancellationToken ct = default)
    {
        var jugador = await db.Players.FindAsync([id], ct);
        if (jugador is null) return PlayerDeleteResult.NotFound;

        // Con inscripciones no se borra (la BD lo bloquearía igualmente con
        // Restrict): se preserva el histórico. Comprobarlo antes da un error claro.
        var tieneInscripciones = await db.Registrations
            .AnyAsync(r => r.Player1Id == id || r.Player2Id == id, ct);
        if (tieneInscripciones) return PlayerDeleteResult.InUse;

        db.Players.Remove(jugador);
        await db.SaveChangesAsync(ct);
        return PlayerDeleteResult.Deleted;
    }

    public async Task<PlayerHistoryResponse?> GetHistoryAsync(int id, CancellationToken ct = default)
    {
        var jugador = await db.Players.FindAsync([id], ct);
        if (jugador is null) return null;

        var inscripciones = await db.Registrations
            .Where(r => r.Player1Id == id || r.Player2Id == id)
            .Include(r => r.Category!).ThenInclude(c => c.Tournament)
            .ToListAsync(ct);

        var idsInscripciones = inscripciones.Select(r => r.Id).ToList();
        var partidos = await db.TournamentMatches
            .Where(m => idsInscripciones.Contains(m.Registration1Id) || idsInscripciones.Contains(m.Registration2Id))
            .Include(m => m.Registration1!).ThenInclude(r => r.Player1)
            .Include(m => m.Registration1!).ThenInclude(r => r.Player2)
            .Include(m => m.Registration2!).ThenInclude(r => r.Player1)
            .Include(m => m.Registration2!).ThenInclude(r => r.Player2)
            .ToListAsync(ct);

        var torneos = inscripciones
            .OrderByDescending(r => r.Category!.Tournament!.FechaInicio).ThenBy(r => r.Id)
            .Select(r => new PlayerTournamentHistory(
                r.Category!.Tournament!.Id,
                r.Category.Tournament.Nombre,
                r.Category.ToResponse(),
                r.Estado.ToString().ToLowerInvariant(),
                partidos
                    .Where(m => m.Registration1Id == r.Id || m.Registration2Id == r.Id)
                    .OrderBy(m => m.FechaHora ?? DateTime.MaxValue).ThenBy(m => m.Id)
                    .Select(m => ToMatchHistory(m, r.Id))
                    .ToList()))
            .ToList();

        return new PlayerHistoryResponse(jugador.Id, jugador.Nombre, torneos);
    }

    private static PlayerMatchHistory ToMatchHistory(TournamentMatch partido, int inscripcionId)
    {
        var rival = partido.Registration1Id == inscripcionId ? partido.Registration2! : partido.Registration1!;
        return new PlayerMatchHistory(
            partido.Id,
            partido.FechaHora,
            partido.Resultado,
            Ganado: partido.GanadorId is null ? null : partido.GanadorId == inscripcionId,
            Rivales: [rival.Player1!.Nombre, rival.Player2!.Nombre]);
    }

    internal static List<string> NormalizarTelefonos(List<string>? telefonos) =>
        telefonos?
            .Select(t => t.Trim())
            .Where(t => t.Length > 0)
            .Distinct()
            .ToList() ?? [];
}
