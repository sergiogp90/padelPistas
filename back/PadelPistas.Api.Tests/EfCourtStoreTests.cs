using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Data;
using PadelPistas.Api.Storage;

namespace PadelPistas.Api.Tests;

// Crea un contexto sobre una base SQLite en memoria y le aplica el esquema + la
// semilla (EnsureCreated ejecuta el HasData del modelo). La conexión debe seguir
// abierta mientras viva el contexto: una BD ":memory:" existe solo mientras su
// conexión está abierta. Quien crea el contexto es responsable de cerrar ambos.
internal static class EfTestDb
{
    public static (PadelPistasDbContext Db, SqliteConnection Connection) Create()
    {
        var connection = new SqliteConnection("Filename=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<PadelPistasDbContext>()
            .UseSqlite(connection)
            .Options;

        var db = new PadelPistasDbContext(options);
        db.Database.EnsureCreated();
        return (db, connection);
    }
}

// Reutiliza el contrato común de ICourtStore (los mismos tres tests que corren
// contra InMemoryCourtStore) ahora contra el almacén real sobre SQLite.
public sealed class EfCourtStoreContractTests : CourtStoreContractTests, IDisposable
{
    private readonly List<SqliteConnection> _connections = [];
    private readonly List<PadelPistasDbContext> _contexts = [];

    protected override ICourtStore CreateStore()
    {
        var (db, connection) = EfTestDb.Create();
        _contexts.Add(db);
        _connections.Add(connection);
        return new EfCourtStore(db);
    }

    public void Dispose()
    {
        foreach (var db in _contexts) db.Dispose();
        foreach (var connection in _connections) connection.Dispose();
    }
}

// Tests propios de la semilla persistida: debe coincidir con la que servía
// InMemoryCourtStore, para que la demo del front no cambie al pasar a la base de datos.
public sealed class EfCourtStoreSeedTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly EfCourtStore _store;

    public EfCourtStoreSeedTests()
    {
        var (db, connection) = EfTestDb.Create();
        _connection = connection;
        _store = new EfCourtStore(db);
    }

    [Fact]
    public async Task Siembra_las_tres_pistas_de_ejemplo()
    {
        var courts = await _store.GetAllAsync();

        Assert.Equal(3, courts.Count);
    }

    [Fact]
    public async Task Devuelve_las_pistas_en_orden()
    {
        var courts = await _store.GetAllAsync();

        Assert.Equal([1, 2, 3], courts.Select(c => c.Id));
    }

    [Fact]
    public async Task La_pista_libre_no_tiene_partido()
    {
        var court = await _store.GetByIdAsync(3);

        Assert.NotNull(court);
        Assert.Null(court.Match);
    }

    [Fact]
    public async Task Cubre_el_punto_de_ventaja_en_la_semilla()
    {
        var court = await _store.GetByIdAsync(2);

        Assert.NotNull(court?.Match);
        Assert.Contains(ApiPoint.Advantage, court.Match.Score.CurrentPoint);
    }

    [Fact]
    public async Task Conserva_el_marcador_completo_tras_ida_y_vuelta_a_JSON()
    {
        var court = await _store.GetByIdAsync(1);

        Assert.NotNull(court?.Match);
        Assert.Equal([1, 0], court.Match.Score.Sets);
        Assert.Equal("Ana", court.Match.Teams[0].Players[0].Name);
        Assert.Equal(ApiGender.Female, court.Match.Teams[0].Players[0].Gender);
    }

    public void Dispose() => _connection.Dispose();
}
