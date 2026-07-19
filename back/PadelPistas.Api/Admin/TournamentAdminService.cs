using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Data;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>Torneos y categorías respaldados por EF Core (ver <see cref="ITournamentAdminService"/>).</summary>
public sealed class TournamentAdminService(PadelPistasDbContext db) : ITournamentAdminService
{
    public async Task<IReadOnlyList<TournamentResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var torneos = await db.Tournaments
            .Include(t => t.Categories)
            .OrderBy(t => t.FechaInicio).ThenBy(t => t.Id)
            .ToListAsync(ct);
        return torneos.Select(ToResponse).ToList();
    }

    public async Task<TournamentResponse?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var torneo = await db.Tournaments
            .Include(t => t.Categories)
            .SingleOrDefaultAsync(t => t.Id == id, ct);
        return torneo is null ? null : ToResponse(torneo);
    }

    public async Task<TournamentResponse> CreateAsync(SaveTournamentRequest request, CancellationToken ct = default)
    {
        // Club único por ahora (igual que CourtAdminService): el torneo cuelga del
        // primer club sembrado. La asociación usuario→club llegará con multi-club.
        var clubId = await db.Clubs.OrderBy(c => c.Id).Select(c => c.Id).FirstAsync(ct);

        var torneo = new Tournament
        {
            ClubId = clubId,
            Nombre = request.Nombre.Trim(),
            FechaInicio = request.FechaInicio,
            FechaFin = request.FechaFin,
            InscripcionApertura = request.InscripcionApertura,
            InscripcionCierre = request.InscripcionCierre,
            PistasDisponibles = request.PistasDisponibles,
        };
        db.Tournaments.Add(torneo);
        await db.SaveChangesAsync(ct);
        return ToResponse(torneo);
    }

    public async Task<bool> UpdateAsync(int id, SaveTournamentRequest request, CancellationToken ct = default)
    {
        var torneo = await db.Tournaments.FindAsync([id], ct);
        if (torneo is null) return false;

        torneo.Nombre = request.Nombre.Trim();
        torneo.FechaInicio = request.FechaInicio;
        torneo.FechaFin = request.FechaFin;
        torneo.InscripcionApertura = request.InscripcionApertura;
        torneo.InscripcionCierre = request.InscripcionCierre;
        torneo.PistasDisponibles = request.PistasDisponibles;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var torneo = await db.Tournaments.FindAsync([id], ct);
        if (torneo is null) return false;

        // El cascade de la BD arrastra categorías, inscripciones y partidos.
        db.Tournaments.Remove(torneo);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<CategoryResponse?> AddCategoryAsync(int tournamentId, int nivel, CategoryGender genero, CancellationToken ct = default)
    {
        var torneo = await db.Tournaments.FindAsync([tournamentId], ct);
        if (torneo is null) return null;

        var grupo = await GrupoAsync(tournamentId, nivel, genero, excludeId: null, ct);
        var categoria = new Category
        {
            TournamentId = tournamentId,
            Nivel = nivel,
            Genero = genero,
            Letra = SiguienteLetra(grupo),
        };
        db.Categories.Add(categoria);
        await db.SaveChangesAsync(ct);
        return ToCategoryResponse(categoria);
    }

    public async Task<bool> UpdateCategoryAsync(int tournamentId, int categoryId, int nivel, CategoryGender genero, CancellationToken ct = default)
    {
        var categoria = await db.Categories
            .SingleOrDefaultAsync(c => c.Id == categoryId && c.TournamentId == tournamentId, ct);
        if (categoria is null) return false;
        if (categoria.Nivel == nivel && categoria.Genero == genero) return true;

        // Cambia de grupo: recibe letra como si fuera nueva en el destino. Las
        // letras del grupo que abandona no se reasignan (igual que al borrar).
        var grupo = await GrupoAsync(tournamentId, nivel, genero, excludeId: categoryId, ct);
        categoria.Nivel = nivel;
        categoria.Genero = genero;
        categoria.Letra = SiguienteLetra(grupo);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteCategoryAsync(int tournamentId, int categoryId, CancellationToken ct = default)
    {
        var categoria = await db.Categories
            .SingleOrDefaultAsync(c => c.Id == categoryId && c.TournamentId == tournamentId, ct);
        if (categoria is null) return false;

        // Sin reasignar letras: "Tercera B" siguió llamándose así aunque ya no
        // exista "Tercera A" (renombrar categorías con inscritos confundiría).
        db.Categories.Remove(categoria);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private Task<List<Category>> GrupoAsync(int tournamentId, int nivel, CategoryGender genero, int? excludeId, CancellationToken ct) =>
        db.Categories
            .Where(c => c.TournamentId == tournamentId && c.Nivel == nivel && c.Genero == genero && c.Id != excludeId)
            .ToListAsync(ct);

    /// <summary>
    /// Letra para una categoría nueva en su grupo (mismo nivel + género). La
    /// primera va sin letra; al llegar la segunda, la existente pasa a "A" (efecto
    /// lateral sobre el grupo cargado) y la nueva continúa desde la letra más alta,
    /// sin rellenar huecos dejados por borrados.
    /// </summary>
    private static string? SiguienteLetra(List<Category> grupo)
    {
        if (grupo.Count == 0) return null;

        var sinLetra = grupo.SingleOrDefault(c => c.Letra is null);
        if (sinLetra is not null) sinLetra.Letra = "A";

        var max = grupo.Max(c => c.Letra![0]);
        if (max >= 'Z')
            throw new InvalidOperationException("No caben más categorías de este nivel y género (letras agotadas).");
        return ((char)(max + 1)).ToString();
    }

    private static TournamentResponse ToResponse(Tournament t) => new(
        t.Id,
        t.Nombre,
        t.FechaInicio,
        t.FechaFin,
        t.InscripcionApertura,
        t.InscripcionCierre,
        t.PistasDisponibles,
        t.Categories
            .OrderBy(c => c.Nivel).ThenBy(c => c.Genero).ThenBy(c => c.Letra)
            .Select(ToCategoryResponse)
            .ToList());

    private static CategoryResponse ToCategoryResponse(Category c) =>
        new(c.Id, c.Nivel, c.Genero.ToString().ToLowerInvariant(), c.Letra);
}
