using Microsoft.Data.Sqlite;
using PadelPistas.Api.Admin;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Data;
using PadelPistas.Api.Storage;

namespace PadelPistas.Api.Tests;

// Escritura del panel probada directamente contra SQLite en memoria (con la semilla
// de 3 pistas). Se verifica el efecto leyendo con EfCourtStore, el mismo origen que
// usan los endpoints públicos.
public sealed class CourtAdminServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly PadelPistasDbContext _db;
    private readonly CourtAdminService _admin;
    private readonly EfCourtStore _store;

    public CourtAdminServiceTests()
    {
        (_db, _connection) = EfTestDb.Create();
        _admin = new CourtAdminService(_db);
        _store = new EfCourtStore(_db);
    }

    private static ApiMatch SampleMatch() => new(
        Teams:
        [
            new ApiTeam([new ApiPlayer("Uno", ApiGender.Male), new ApiPlayer("Dos", ApiGender.Male)]),
            new ApiTeam([new ApiPlayer("Tres", ApiGender.Female), new ApiPlayer("Cuatro", ApiGender.Female)]),
        ],
        Score: new ApiScore(CurrentPoint: [ApiPoint.Fifteen, ApiPoint.Love], Games: [[0, 0]], Sets: [0, 0]));

    [Fact]
    public async Task CreateAsync_anade_la_pista_al_final()
    {
        var creada = await _admin.CreateAsync("  Pista 4  ");

        Assert.Equal("Pista 4", creada.Name); // recorta espacios
        Assert.Null(creada.Match);
        var todas = await _store.GetAllAsync();
        Assert.Equal(4, todas.Count);
        Assert.Equal(creada.Id, todas[^1].Id); // queda la última por orden
    }

    [Fact]
    public async Task RenameAsync_cambia_el_nombre()
    {
        Assert.True(await _admin.RenameAsync(1, "Pista Renombrada"));

        var court = await _store.GetByIdAsync(1);
        Assert.Equal("Pista Renombrada", court!.Name);
    }

    [Fact]
    public async Task RenameAsync_devuelve_false_si_no_existe() =>
        Assert.False(await _admin.RenameAsync(999, "X"));

    [Fact]
    public async Task DeleteAsync_elimina_la_pista()
    {
        Assert.True(await _admin.DeleteAsync(3));

        Assert.Null(await _store.GetByIdAsync(3));
        Assert.Equal(2, (await _store.GetAllAsync()).Count);
    }

    [Fact]
    public async Task SetMatchAsync_fija_el_partido()
    {
        Assert.True(await _admin.SetMatchAsync(3, SampleMatch()));

        var court = await _store.GetByIdAsync(3);
        Assert.NotNull(court!.Match);
        Assert.Equal("Uno", court.Match!.Teams[0].Players[0].Name);
    }

    [Fact]
    public async Task ClearMatchAsync_libera_la_pista()
    {
        Assert.True(await _admin.ClearMatchAsync(1)); // la 1 tenía partido en la semilla

        var court = await _store.GetByIdAsync(1);
        Assert.Null(court!.Match);
    }

    [Fact]
    public async Task ReorderAsync_reasigna_el_orden()
    {
        Assert.True(await _admin.ReorderAsync([3, 1, 2]));

        var ids = (await _store.GetAllAsync()).Select(c => c.Id);
        Assert.Equal([3, 1, 2], ids);
    }

    [Fact]
    public async Task ReorderAsync_devuelve_false_si_algun_id_no_existe() =>
        Assert.False(await _admin.ReorderAsync([1, 2, 999]));

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }
}
