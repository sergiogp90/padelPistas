using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Data;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Tests;

// Persistencia del dominio de torneos (M10) sobre SQLite en memoria. Cada test
// guarda con un contexto "limpio" y relee tras ChangeTracker.Clear() para forzar
// la ida y vuelta real por la base de datos (conversores JSON incluidos).
public sealed class TournamentDomainTests : IDisposable
{
    private readonly PadelPistasDbContext _db;
    private readonly SqliteConnection _connection;

    public TournamentDomainTests()
    {
        (_db, _connection) = EfTestDb.Create();
    }

    private Tournament NuevoTorneo() => new()
    {
        ClubId = 1, // club sembrado
        Nombre = "Torneo de Verano",
        FechaInicio = new DateOnly(2026, 9, 7),
        FechaFin = new DateOnly(2026, 9, 13),
        InscripcionApertura = new DateTime(2026, 8, 1, 9, 0, 0),
        InscripcionCierre = new DateTime(2026, 9, 1, 23, 59, 0),
        PistasDisponibles = 3,
    };

    private (Player, Player) DosJugadores()
    {
        var ana = new Player { Nombre = "Ana", Telefonos = ["600111222"] };
        var lucia = new Player { Nombre = "Lucía", Telefonos = ["600333444"] };
        _db.Players.AddRange(ana, lucia);
        return (ana, lucia);
    }

    // Inscribe la pareja respetando la convención Player1Id < Player2Id.
    private Registration NuevaInscripcion(Category categoria, Player a, Player b) => new()
    {
        Category = categoria,
        Player1Id = Math.Min(a.Id, b.Id),
        Player2Id = Math.Max(a.Id, b.Id),
    };

    [Fact]
    public async Task Guarda_y_relee_un_torneo_con_sus_categorias()
    {
        var torneo = NuevoTorneo();
        torneo.Categories.Add(new Category { Nivel = 3, Genero = CategoryGender.Masculino, Letra = "A" });
        torneo.Categories.Add(new Category { Nivel = 3, Genero = CategoryGender.Masculino, Letra = "B" });
        torneo.Categories.Add(new Category { Nivel = 1, Genero = CategoryGender.Mixto });
        _db.Tournaments.Add(torneo);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var releido = await _db.Tournaments.Include(t => t.Categories).SingleAsync(t => t.Id == torneo.Id);

        Assert.Equal(new DateOnly(2026, 9, 7), releido.FechaInicio);
        Assert.Equal(3, releido.PistasDisponibles);
        Assert.Equal(3, releido.Categories.Count);
        Assert.Contains(releido.Categories, c => c is { Nivel: 3, Letra: "B" });
        Assert.Contains(releido.Categories, c => c is { Genero: CategoryGender.Mixto, Letra: null });
    }

    [Fact]
    public async Task Los_telefonos_del_jugador_sobreviven_la_ida_y_vuelta()
    {
        var jugador = new Player { Nombre = "Carlos", Telefonos = ["600123456", "911223344"] };
        _db.Players.Add(jugador);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var releido = await _db.Players.SingleAsync(p => p.Id == jugador.Id);

        Assert.Equal(["600123456", "911223344"], releido.Telefonos);
    }

    [Fact]
    public async Task La_disponibilidad_de_la_pareja_sobrevive_la_ida_y_vuelta()
    {
        var torneo = NuevoTorneo();
        var categoria = new Category { Tournament = torneo, Nivel = 2, Genero = CategoryGender.Femenino };
        var (ana, lucia) = DosJugadores();
        await _db.SaveChangesAsync();

        var inscripcion = NuevaInscripcion(categoria, ana, lucia);
        inscripcion.Disponibilidad =
        [
            new AvailabilitySlot(new DateOnly(2026, 9, 7), 18),
            new AvailabilitySlot(new DateOnly(2026, 9, 7), 19),
            new AvailabilitySlot(new DateOnly(2026, 9, 12), 10),
        ];
        _db.Registrations.Add(inscripcion);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        var releida = await _db.Registrations.SingleAsync(r => r.Id == inscripcion.Id);

        Assert.Equal(3, releida.Disponibilidad.Count);
        Assert.Contains(new AvailabilitySlot(new DateOnly(2026, 9, 12), 10), releida.Disponibilidad);
        Assert.Equal(RegistrationStatus.Pendiente, releida.Estado);
        Assert.False(releida.Pagada);
    }

    [Fact]
    public async Task Rechaza_inscribir_la_misma_pareja_dos_veces_en_la_misma_categoria()
    {
        var torneo = NuevoTorneo();
        var categoria = new Category { Tournament = torneo, Nivel = 3, Genero = CategoryGender.Masculino };
        var (a, b) = DosJugadores();
        await _db.SaveChangesAsync();

        _db.Registrations.Add(NuevaInscripcion(categoria, a, b));
        await _db.SaveChangesAsync();

        _db.Registrations.Add(NuevaInscripcion(categoria, a, b));
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task Rechaza_una_pareja_desordenada_o_con_el_jugador_repetido()
    {
        var torneo = NuevoTorneo();
        var categoria = new Category { Tournament = torneo, Nivel = 3, Genero = CategoryGender.Masculino };
        var (a, b) = DosJugadores();
        await _db.SaveChangesAsync();

        // Desordenada (Player1Id > Player2Id): viola CK_Registrations_ParejaOrdenada.
        _db.Registrations.Add(new Registration { Category = categoria, Player1Id = b.Id, Player2Id = a.Id });
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
        _db.ChangeTracker.Clear();

        // El mismo jugador dos veces: también la viola (no se cumple "<").
        _db.Registrations.Add(new Registration { Category = categoria, Player1Id = a.Id, Player2Id = a.Id });
        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task El_historico_del_jugador_se_deriva_de_inscripciones_y_partidos()
    {
        var torneo = NuevoTorneo();
        var categoria = new Category { Tournament = torneo, Nivel = 2, Genero = CategoryGender.Mixto };
        var (ana, lucia) = DosJugadores();
        var marta = new Player { Nombre = "Marta" };
        var sara = new Player { Nombre = "Sara" };
        _db.Players.AddRange(marta, sara);
        await _db.SaveChangesAsync();

        var pareja1 = NuevaInscripcion(categoria, ana, lucia);
        var pareja2 = NuevaInscripcion(categoria, marta, sara);
        _db.Registrations.AddRange(pareja1, pareja2);
        await _db.SaveChangesAsync();

        _db.TournamentMatches.Add(new TournamentMatch
        {
            CategoryId = categoria.Id,
            Registration1Id = pareja1.Id,
            Registration2Id = pareja2.Id,
            Resultado = "6-3 6-4",
            GanadorId = pareja1.Id,
        });
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();

        // Torneos en los que participa Ana, vía sus inscripciones.
        var torneosDeAna = await _db.Registrations
            .Where(r => r.Player1Id == ana.Id || r.Player2Id == ana.Id)
            .Select(r => r.Category!.Tournament!.Nombre)
            .Distinct()
            .ToListAsync();
        Assert.Equal(["Torneo de Verano"], torneosDeAna);

        // Partidos jugados por su pareja en ese torneo.
        var partidos = await _db.TournamentMatches
            .Where(m => m.Registration1Id == pareja1.Id || m.Registration2Id == pareja1.Id)
            .ToListAsync();
        var partido = Assert.Single(partidos);
        Assert.Equal("6-3 6-4", partido.Resultado);
        Assert.Equal(pareja1.Id, partido.GanadorId);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }
}

// La app aplica las migraciones al arrancar (Program.cs); este test cubre el
// criterio de que el historial completo de migraciones construye la BD desde cero
// (EnsureCreated no las ejercita: crea el esquema directamente desde el modelo).
public sealed class TournamentMigrationsTests
{
    [Fact]
    public void Las_migraciones_aplican_desde_cero_e_incluyen_la_semilla()
    {
        using var connection = new SqliteConnection("Filename=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<PadelPistasDbContext>()
            .UseSqlite(connection)
            .Options;

        using var db = new PadelPistasDbContext(options);
        db.Database.Migrate();

        Assert.Single(db.Clubs);
        Assert.Equal(3, db.Courts.Count());
        Assert.Empty(db.Tournaments);
        Assert.Empty(db.Players);
    }
}
