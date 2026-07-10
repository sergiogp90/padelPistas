using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PadelPistas.Api.Auth;
using PadelPistas.Api.Contracts;
using PadelPistas.Api.Data;

namespace PadelPistas.Api.Tests;

// Integración de la escritura + auth: levanta la API real sobre una BD SQLite en
// memoria compartida (para que escritura y lectura vean lo mismo) y con un admin
// de prueba configurado. El cliente conserva la cookie entre peticiones
// (HandleCookies = true por defecto), así que el login "persiste" en la sesión.
public class AdminApiTests : IClassFixture<AdminApiTests.Factory>
{
    private const string AdminEmail = "admin@test.local";
    private const string AdminPassword = "secreto";

    public sealed class Factory : WebApplicationFactory<Program>
    {
        private SqliteConnection? _connection;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Admin:Email"] = AdminEmail,
                    ["Admin:PasswordHash"] = AdminPasswordHasher.Hash(AdminPassword),
                }));

            builder.ConfigureTestServices(services =>
            {
                // BD SQLite en memoria compartida: viva mientras lo esté la conexión.
                _connection = new SqliteConnection("Filename=:memory:");
                _connection.Open();

                services.RemoveAll<DbContextOptions<PadelPistasDbContext>>();
                services.AddDbContext<PadelPistasDbContext>(options => options.UseSqlite(_connection));

                // Crea el esquema + la semilla (HasData) en esa BD en memoria.
                using var provider = services.BuildServiceProvider();
                using var scope = provider.CreateScope();
                scope.ServiceProvider.GetRequiredService<PadelPistasDbContext>().Database.EnsureCreated();
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            _connection?.Dispose();
        }
    }

    private readonly Factory _factory;

    public AdminApiTests(Factory factory) => _factory = factory;

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string password = AdminPassword) =>
        client.PostAsJsonAsync("/api/auth/login", new { email = AdminEmail, password });

    private static object ValidMatch() => new
    {
        teams = new[]
        {
            new { players = new[] { new { name = "Uno", gender = "male" }, new { name = "Dos", gender = "male" } } },
            new { players = new[] { new { name = "Tres", gender = "female" }, new { name = "Cuatro", gender = "female" } } },
        },
        score = new { currentPoint = new object[] { 15, 0 }, games = new[] { new[] { 0, 0 } }, sets = new[] { 0, 0 } },
    };

    [Fact]
    public async Task Sin_autenticar_las_rutas_admin_devuelven_401()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/admin/courts", new { nombre = "X" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_con_credenciales_correctas_devuelve_200()
    {
        var response = await LoginAsync(_factory.CreateClient());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_con_contrasena_incorrecta_devuelve_401()
    {
        var response = await LoginAsync(_factory.CreateClient(), password: "mala");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Crear_pista_autenticado_y_verla_en_la_lectura_publica()
    {
        var client = _factory.CreateClient();
        await LoginAsync(client);

        var creada = await client.PostAsJsonAsync("/api/admin/courts", new { nombre = "Pista Nueva" });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);

        var courts = await client.GetFromJsonAsync<ApiCourt[]>("/api/courts");
        Assert.NotNull(courts);
        Assert.Contains(courts, c => c.Name == "Pista Nueva");
    }

    [Fact]
    public async Task Fijar_un_partido_invalido_devuelve_400()
    {
        var client = _factory.CreateClient();
        await LoginAsync(client);

        // Un solo equipo: forma inválida para el pádel.
        var invalido = new
        {
            teams = new[]
            {
                new { players = new[] { new { name = "A", gender = "male" }, new { name = "B", gender = "male" } } },
            },
            score = new { currentPoint = new object[] { 0, 0 }, games = new[] { new[] { 0, 0 } }, sets = new[] { 0, 0 } },
        };

        var response = await client.PutAsJsonAsync("/api/admin/courts/3/match", invalido);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Fijar_y_liberar_el_partido_de_una_pista()
    {
        var client = _factory.CreateClient();
        await LoginAsync(client);

        var set = await client.PutAsJsonAsync("/api/admin/courts/3/match", ValidMatch());
        Assert.Equal(HttpStatusCode.NoContent, set.StatusCode);

        var conPartido = await client.GetFromJsonAsync<ApiCourt>("/api/courts/3");
        Assert.NotNull(conPartido!.Match);

        var clear = await client.DeleteAsync("/api/admin/courts/3/match");
        Assert.Equal(HttpStatusCode.NoContent, clear.StatusCode);

        var libre = await client.GetFromJsonAsync<ApiCourt>("/api/courts/3");
        Assert.Null(libre!.Match);
    }

    [Fact]
    public async Task Editar_una_pista_inexistente_devuelve_404()
    {
        var client = _factory.CreateClient();
        await LoginAsync(client);

        var response = await client.DeleteAsync("/api/admin/courts/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
