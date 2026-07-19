using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Data;

/// <summary>
/// Contexto de EF Core del backend. Hoy respaldado por SQLite (ver Program.cs);
/// el proveedor es intercambiable a Azure SQL/Postgres sin tocar este modelo.
/// </summary>
public sealed class PadelPistasDbContext(DbContextOptions<PadelPistasDbContext> options)
    : DbContext(options)
{
    public DbSet<Club> Clubs => Set<Club>();

    public DbSet<Court> Courts => Set<Court>();

    public DbSet<Tournament> Tournaments => Set<Tournament>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Player> Players => Set<Player>();

    public DbSet<Registration> Registrations => Set<Registration>();

    public DbSet<TournamentMatch> TournamentMatches => Set<TournamentMatch>();

    // Mismas opciones que el contrato del cable (Program.cs): así el snapshot del
    // partido se persiste con los mismos tokens (p. ej. la ventaja como "AD", vía
    // ApiPointJsonConverter) que viajan por la red hacia el front.
    private static readonly JsonSerializerOptions MatchJson = new(JsonSerializerDefaults.Web);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var club = modelBuilder.Entity<Club>();
        club.Property(c => c.Nombre).HasMaxLength(200);
        club.Property(c => c.Slug).HasMaxLength(100);
        club.HasIndex(c => c.Slug).IsUnique();

        var court = modelBuilder.Entity<Court>();
        court.Property(c => c.Nombre).HasMaxLength(200);

        // El partido en curso se guarda serializado a JSON con la forma de ApiMatch.
        var matchConverter = new ValueConverter<ApiMatch?, string?>(
            match => match == null ? null : JsonSerializer.Serialize(match, MatchJson),
            text => string.IsNullOrEmpty(text) ? null : JsonSerializer.Deserialize<ApiMatch>(text, MatchJson));

        // El snapshot se reemplaza entero al editar, nunca se muta en sitio; comparar
        // por su JSON asegura que EF detecte los cambios de contenido y clone bien.
        var matchComparer = new ValueComparer<ApiMatch?>(
            (a, b) => JsonSerializer.Serialize(a, MatchJson) == JsonSerializer.Serialize(b, MatchJson),
            match => match == null ? 0 : JsonSerializer.Serialize(match, MatchJson).GetHashCode(),
            match => match == null ? null : JsonSerializer.Deserialize<ApiMatch>(JsonSerializer.Serialize(match, MatchJson), MatchJson));

        court.Property(c => c.CurrentMatch)
            .HasConversion(matchConverter, matchComparer)
            .HasColumnType("TEXT")
            .HasColumnName("CurrentMatchJson");

        court.HasOne(c => c.Club)
            .WithMany(c => c.Courts)
            .HasForeignKey(c => c.ClubId)
            .OnDelete(DeleteBehavior.Cascade);

        ConfigureTournaments(modelBuilder);

        Seed(modelBuilder);
    }

    // Dominio de torneos (M10): torneo → categorías → inscripciones de parejas,
    // más jugadores y partidos de torneo (mínimos, preparatorios para los cuadros).
    private static void ConfigureTournaments(ModelBuilder modelBuilder)
    {
        var tournament = modelBuilder.Entity<Tournament>();
        tournament.Property(t => t.Nombre).HasMaxLength(200);
        tournament.HasOne(t => t.Club)
            .WithMany(c => c.Tournaments)
            .HasForeignKey(t => t.ClubId)
            .OnDelete(DeleteBehavior.Cascade);

        var category = modelBuilder.Entity<Category>();
        // Los enums se guardan como texto: la BD se puede leer/depurar a mano y el
        // orden de los miembros del enum deja de importar.
        category.Property(c => c.Genero).HasConversion<string>().HasMaxLength(20);
        category.Property(c => c.Letra).HasMaxLength(1);
        category.HasOne(c => c.Tournament)
            .WithMany(t => t.Categories)
            .HasForeignKey(c => c.TournamentId)
            .OnDelete(DeleteBehavior.Cascade);
        // Único parcial: SQLite admite varias filas con Letra NULL, así que la
        // unicidad "solo una categoría sin letra por nivel+género" la garantiza el
        // servicio de administración al asignar letras.
        category.HasIndex(c => new { c.TournamentId, c.Nivel, c.Genero, c.Letra }).IsUnique();

        var player = modelBuilder.Entity<Player>();
        player.Property(p => p.Nombre).HasMaxLength(200);
        // Telefonos es una colección primitiva: EF la mapea a una columna JSON.

        var registration = modelBuilder.Entity<Registration>();
        registration.Property(r => r.Estado).HasConversion<string>().HasMaxLength(20);
        registration.HasOne(r => r.Category)
            .WithMany(c => c.Registrations)
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
        // Borrar un jugador con inscripciones se bloquea: su histórico depende de ellas.
        registration.HasOne(r => r.Player1)
            .WithMany()
            .HasForeignKey(r => r.Player1Id)
            .OnDelete(DeleteBehavior.Restrict);
        registration.HasOne(r => r.Player2)
            .WithMany()
            .HasForeignKey(r => r.Player2Id)
            .OnDelete(DeleteBehavior.Restrict);
        // La pareja se guarda ordenada (ver Registration): el CHECK fuerza la
        // convención (y de paso que los dos jugadores sean distintos) y el índice
        // único impide inscribirla dos veces en la misma categoría.
        registration.ToTable(t =>
            t.HasCheckConstraint("CK_Registrations_ParejaOrdenada", "\"Player1Id\" < \"Player2Id\""));
        registration.HasIndex(r => new { r.CategoryId, r.Player1Id, r.Player2Id }).IsUnique();

        var slotsConverter = new ValueConverter<List<AvailabilitySlot>, string>(
            slots => JsonSerializer.Serialize(slots, MatchJson),
            text => string.IsNullOrEmpty(text)
                ? new List<AvailabilitySlot>()
                : JsonSerializer.Deserialize<List<AvailabilitySlot>>(text, MatchJson)!);

        var slotsComparer = new ValueComparer<List<AvailabilitySlot>>(
            (a, b) => JsonSerializer.Serialize(a, MatchJson) == JsonSerializer.Serialize(b, MatchJson),
            slots => JsonSerializer.Serialize(slots, MatchJson).GetHashCode(),
            slots => JsonSerializer.Deserialize<List<AvailabilitySlot>>(JsonSerializer.Serialize(slots, MatchJson), MatchJson)!);

        registration.Property(r => r.Disponibilidad)
            .HasConversion(slotsConverter, slotsComparer)
            .HasColumnType("TEXT")
            .HasColumnName("DisponibilidadJson");

        var match = modelBuilder.Entity<TournamentMatch>();
        match.Property(m => m.Resultado).HasMaxLength(100);
        match.HasOne(m => m.Category)
            .WithMany()
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
        // Borrar una inscripción arrastra sus partidos (y con ellos el histórico);
        // retirar una pareja sin perder nada es cambiar su Estado, no borrarla.
        match.HasOne(m => m.Registration1)
            .WithMany()
            .HasForeignKey(m => m.Registration1Id)
            .OnDelete(DeleteBehavior.Cascade);
        match.HasOne(m => m.Registration2)
            .WithMany()
            .HasForeignKey(m => m.Registration2Id)
            .OnDelete(DeleteBehavior.Cascade);
    }

    // Reproduce exactamente la semilla que servía InMemoryCourtStore, para que la
    // demo del front no cambie al pasar de datos fijos en memoria a datos persistidos.
    private static void Seed(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Club>().HasData(
            new Club { Id = 1, Nombre = "Club de ejemplo", Slug = "lgancce" });

        modelBuilder.Entity<Court>().HasData(
            new Court
            {
                Id = 1,
                ClubId = 1,
                Nombre = "Pista Central",
                Orden = 1,
                // Partido en curso: set ganado (1-0) y segundo set en juego.
                CurrentMatch = new ApiMatch(
                    Teams:
                    [
                        new ApiTeam([new ApiPlayer("Ana", ApiGender.Female), new ApiPlayer("Lucía", ApiGender.Female)]),
                        new ApiTeam([new ApiPlayer("Marta", ApiGender.Female), new ApiPlayer("Sara", ApiGender.Female)]),
                    ],
                    Score: new ApiScore(
                        CurrentPoint: [ApiPoint.Thirty, ApiPoint.Forty],
                        Games: [[6, 4], [3, 5]],
                        Sets: [1, 0])),
            },
            new Court
            {
                Id = 2,
                ClubId = 1,
                Nombre = "Pista 2",
                Orden = 2,
                // Ejemplo del token de ventaja ("AD").
                CurrentMatch = new ApiMatch(
                    Teams:
                    [
                        new ApiTeam([new ApiPlayer("Carlos", ApiGender.Male), new ApiPlayer("Javier", ApiGender.Male)]),
                        new ApiTeam([new ApiPlayer("Diego", ApiGender.Male), new ApiPlayer("Pablo", ApiGender.Male)]),
                    ],
                    Score: new ApiScore(
                        CurrentPoint: [ApiPoint.Advantage, ApiPoint.Forty],
                        Games: [[5, 5]],
                        Sets: [0, 0])),
            },
            // Pista libre: cubre el caso match == null del contrato.
            new Court { Id = 3, ClubId = 1, Nombre = "Pista 3", Orden = 3, CurrentMatch = null });
    }
}
