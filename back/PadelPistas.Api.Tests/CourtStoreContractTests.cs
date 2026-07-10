using System.Text.Json;
using PadelPistas.Api.Storage;

namespace PadelPistas.Api.Tests;

// Contrato que TODA implementación de ICourtStore debe cumplir, sin depender de
// datos concretos. El día que exista SqliteCourtStore, se deriva esta clase y se
// reusa tal cual: los tests se escriben una vez y valen para todos los almacenes.
public abstract class CourtStoreContractTests
{
    protected abstract ICourtStore CreateStore();

    [Fact]
    public async Task GetAllAsync_nunca_devuelve_null()
    {
        var store = CreateStore();

        var courts = await store.GetAllAsync();

        Assert.NotNull(courts);
    }

    [Fact]
    public async Task GetByIdAsync_devuelve_null_si_no_existe()
    {
        var store = CreateStore();

        Assert.Null(await store.GetByIdAsync(int.MinValue));
    }

    [Fact]
    public async Task GetByIdAsync_recupera_cada_pista_de_GetAllAsync()
    {
        var store = CreateStore();

        // ApiCourt es un DTO de cable con arrays anidados: su igualdad de valor real
        // es la de su JSON, no la del record (que compararía los arrays por referencia
        // y solo coincidiría si el almacén reutiliza las mismas instancias).
        foreach (var court in await store.GetAllAsync())
        {
            var byId = await store.GetByIdAsync(court.Id);
            Assert.Equal(Serialize(court), Serialize(byId));
        }
    }

    private static string Serialize(object? value) =>
        JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
}

// Los tres tests de arriba corren automáticamente contra InMemoryCourtStore.
public class InMemoryCourtStoreContractTests : CourtStoreContractTests
{
    protected override ICourtStore CreateStore() => new InMemoryCourtStore();
}
