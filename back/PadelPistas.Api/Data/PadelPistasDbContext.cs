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

        Seed(modelBuilder);
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
