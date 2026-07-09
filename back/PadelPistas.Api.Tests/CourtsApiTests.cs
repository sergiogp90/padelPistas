using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Storage;

namespace PadelPistas.Api.Tests;

// Tests de integración: levantan la API real en memoria y le pegan peticiones
// HTTP. Prueban routing + serialización + contrato, no el almacén; por eso
// sobreviven al cambio a SQLite u otra base de datos más adelante.
public class CourtsApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    // Mismo naming policy que Program.cs; los enums traen su conversor por atributo.
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    private readonly WebApplicationFactory<Program> _factory;

    public CourtsApiTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task GET_courts_devuelve_200_y_json()
    {
        var response = await _factory.CreateClient().GetAsync("/api/courts");

        response.EnsureSuccessStatusCode();
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GET_courts_serializa_el_contrato_en_el_cable()
    {
        var json = await _factory.CreateClient().GetStringAsync("/api/courts");

        // Propiedades en camelCase y tokens del contrato tal como los espera el front.
        Assert.Contains("\"currentPoint\"", json);
        Assert.Contains("\"female\"", json);
        Assert.Contains("\"AD\"", json);
    }

    [Fact]
    public async Task GET_courts_deserializa_a_los_dtos_del_contrato()
    {
        var courts = await _factory.CreateClient()
            .GetFromJsonAsync<ApiCourt[]>("/api/courts", JsonOptions);

        Assert.NotNull(courts);
        Assert.Equal(3, courts.Length);
    }

    [Fact]
    public async Task GET_court_por_id_existente_devuelve_la_pista()
    {
        var court = await _factory.CreateClient()
            .GetFromJsonAsync<ApiCourt>("/api/courts/1", JsonOptions);

        Assert.NotNull(court);
        Assert.Equal(1, court.Id);
    }

    [Fact]
    public async Task GET_court_por_id_inexistente_devuelve_404()
    {
        var response = await _factory.CreateClient().GetAsync("/api/courts/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Los_endpoints_no_dependen_del_almacen_concreto()
    {
        // Sustituimos el store por uno de prueba: si el endpoint devuelve sus datos,
        // queda demostrado que depende de ICourtStore y no de la implementación.
        var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
                services.Replace(ServiceDescriptor.Singleton<ICourtStore, FakeCourtStore>())));

        var courts = await factory.CreateClient()
            .GetFromJsonAsync<ApiCourt[]>("/api/courts", JsonOptions);

        Assert.NotNull(courts);
        Assert.Equal("Pista de prueba", Assert.Single(courts).Name);
    }

    private sealed class FakeCourtStore : ICourtStore
    {
        private static readonly ApiCourt[] Courts = [new ApiCourt(42, "Pista de prueba", Match: null)];

        public Task<IReadOnlyList<ApiCourt>> GetAllAsync(CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<ApiCourt>>(Courts);

        public Task<ApiCourt?> GetByIdAsync(int id, CancellationToken ct = default) =>
            Task.FromResult(Array.Find(Courts, c => c.Id == id));
    }
}
