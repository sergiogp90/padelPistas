using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Data;

namespace PadelPistas.Api.Storage;

/// <summary>
/// Implementación de <see cref="ICourtStore"/> respaldada por la base de datos
/// (EF Core). Sustituye a <see cref="InMemoryCourtStore"/> como origen real de los
/// endpoints de lectura; el contrato (<see cref="ApiCourt"/>) y los endpoints no
/// cambian (ver ADR 0004).
///
/// El mapeo entidad → DTO se hace en memoria tras materializar (son pocas pistas):
/// el partido vive como snapshot JSON con la forma de <see cref="ApiMatch"/>, así
/// que <see cref="Domain.Court.CurrentMatch"/> ya es exactamente lo que espera el
/// contrato y no hay traducción que hacer.
/// </summary>
public sealed class EfCourtStore(PadelPistasDbContext db) : ICourtStore
{
    public async Task<IReadOnlyList<ApiCourt>> GetAllAsync(CancellationToken ct = default)
    {
        var courts = await db.Courts
            .AsNoTracking()
            .OrderBy(c => c.Orden)
            .ToListAsync(ct);

        return courts.Select(c => new ApiCourt(c.Id, c.Nombre, c.CurrentMatch)).ToList();
    }

    public async Task<ApiCourt?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var court = await db.Courts
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        return court is null ? null : new ApiCourt(court.Id, court.Nombre, court.CurrentMatch);
    }
}
