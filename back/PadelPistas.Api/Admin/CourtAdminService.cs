using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Data;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>Escritura de pistas respaldada por EF Core (ver <see cref="ICourtAdminService"/>).</summary>
public sealed class CourtAdminService(PadelPistasDbContext db) : ICourtAdminService
{
    public async Task<ApiCourt> CreateAsync(string nombre, CancellationToken ct = default)
    {
        // Club único en M1: la pista cuelga del primer (y único) club sembrado.
        var clubId = await db.Clubs.OrderBy(c => c.Id).Select(c => c.Id).FirstAsync(ct);
        var maxOrden = await db.Courts.Where(c => c.ClubId == clubId)
            .Select(c => (int?)c.Orden).MaxAsync(ct) ?? 0;

        var court = new Court { ClubId = clubId, Nombre = nombre.Trim(), Orden = maxOrden + 1 };
        db.Courts.Add(court);
        await db.SaveChangesAsync(ct);
        return new ApiCourt(court.Id, court.Nombre, court.CurrentMatch);
    }

    public async Task<bool> RenameAsync(int id, string nombre, CancellationToken ct = default)
    {
        var court = await db.Courts.FindAsync([id], ct);
        if (court is null) return false;

        court.Nombre = nombre.Trim();
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var court = await db.Courts.FindAsync([id], ct);
        if (court is null) return false;

        db.Courts.Remove(court);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> SetMatchAsync(int id, ApiMatch match, CancellationToken ct = default)
    {
        var court = await db.Courts.FindAsync([id], ct);
        if (court is null) return false;

        court.CurrentMatch = match;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> ClearMatchAsync(int id, CancellationToken ct = default)
    {
        var court = await db.Courts.FindAsync([id], ct);
        if (court is null) return false;

        court.CurrentMatch = null;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> ReorderAsync(IReadOnlyList<int> orderedIds, CancellationToken ct = default)
    {
        var byId = await db.Courts.ToDictionaryAsync(c => c.Id, ct);

        // Todos los ids deben existir; si alguno no, no se reordena nada.
        if (!orderedIds.All(byId.ContainsKey)) return false;

        for (var i = 0; i < orderedIds.Count; i++)
            byId[orderedIds[i]].Orden = i + 1;

        await db.SaveChangesAsync(ct);
        return true;
    }
}
