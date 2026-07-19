using System.Net;
using System.Net.Http.Json;
using PadelPistas.Api.Admin;

namespace PadelPistas.Api.Tests;

// Integración de los endpoints de torneos y categorías (/api/admin/tournaments),
// reutilizando la Factory de AdminApiTests (API real + SQLite en memoria + admin
// de prueba). Cada test crea su propio torneo para no interferir con los demás.
public class TournamentAdminApiTests : IClassFixture<AdminApiTests.Factory>
{
    private readonly AdminApiTests.Factory _factory;

    public TournamentAdminApiTests(AdminApiTests.Factory factory) => _factory = factory;

    private async Task<HttpClient> ClienteAutenticadoAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new { email = AdminApiTests.AdminEmail, password = AdminApiTests.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return client;
    }

    private static object TorneoValido(string nombre) => new
    {
        nombre,
        fechaInicio = "2026-09-07",
        fechaFin = "2026-09-13",
        inscripcionApertura = "2026-08-01T09:00:00",
        inscripcionCierre = "2026-09-01T23:59:00",
        pistasDisponibles = 3,
    };

    private async Task<TournamentResponse> CrearTorneoAsync(HttpClient client, string nombre)
    {
        var response = await client.PostAsJsonAsync("/api/admin/tournaments", TorneoValido(nombre));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TournamentResponse>())!;
    }

    private static async Task<CategoryResponse> CrearCategoriaAsync(HttpClient client, int torneoId, int nivel, string genero)
    {
        var response = await client.PostAsJsonAsync($"/api/admin/tournaments/{torneoId}/categories", new { nivel, genero });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<CategoryResponse>())!;
    }

    private static async Task<TournamentResponse> DetalleAsync(HttpClient client, int torneoId) =>
        (await client.GetFromJsonAsync<TournamentResponse>($"/api/admin/tournaments/{torneoId}"))!;

    [Fact]
    public async Task Sin_autenticar_los_torneos_devuelven_401()
    {
        var client = _factory.CreateClient();

        var lectura = await client.GetAsync("/api/admin/tournaments");
        var escritura = await client.PostAsJsonAsync("/api/admin/tournaments", TorneoValido("X"));

        Assert.Equal(HttpStatusCode.Unauthorized, lectura.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, escritura.StatusCode);
    }

    [Fact]
    public async Task Crear_editar_y_borrar_un_torneo()
    {
        var client = await ClienteAutenticadoAsync();

        var creado = await CrearTorneoAsync(client, "Open de Otoño");
        Assert.Equal(new DateOnly(2026, 9, 7), creado.FechaInicio);
        Assert.Empty(creado.Categorias);

        var edicion = await client.PutAsJsonAsync($"/api/admin/tournaments/{creado.Id}", new
        {
            nombre = "Open de Otoño (2ª edición)",
            fechaInicio = "2026-09-07",
            fechaFin = "2026-09-14",
            inscripcionApertura = "2026-08-01T09:00:00",
            inscripcionCierre = "2026-09-01T23:59:00",
            pistasDisponibles = 4,
        });
        Assert.Equal(HttpStatusCode.NoContent, edicion.StatusCode);

        var editado = await DetalleAsync(client, creado.Id);
        Assert.Equal("Open de Otoño (2ª edición)", editado.Nombre);
        Assert.Equal(4, editado.PistasDisponibles);

        var borrado = await client.DeleteAsync($"/api/admin/tournaments/{creado.Id}");
        Assert.Equal(HttpStatusCode.NoContent, borrado.StatusCode);

        var tras = await client.GetAsync($"/api/admin/tournaments/{creado.Id}");
        Assert.Equal(HttpStatusCode.NotFound, tras.StatusCode);
    }

    [Theory]
    [InlineData("2026-09-13", "2026-09-07", "2026-08-01T09:00:00", "2026-09-01T23:59:00", 3)] // fin < inicio
    [InlineData("2026-09-07", "2026-09-13", "2026-09-01T23:59:00", "2026-08-01T09:00:00", 3)] // cierre < apertura
    [InlineData("2026-09-07", "2026-09-13", "2026-08-01T09:00:00", "2026-09-01T23:59:00", 0)] // sin pistas
    public async Task Un_torneo_incoherente_devuelve_400(
        string inicio, string fin, string apertura, string cierre, int pistas)
    {
        var client = await ClienteAutenticadoAsync();

        var response = await client.PostAsJsonAsync("/api/admin/tournaments", new
        {
            nombre = "Inválido",
            fechaInicio = inicio,
            fechaFin = fin,
            inscripcionApertura = apertura,
            inscripcionCierre = cierre,
            pistasDisponibles = pistas,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task La_primera_categoria_de_un_tipo_va_sin_letra()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "Letras 1");

        var categoria = await CrearCategoriaAsync(client, torneo.Id, nivel: 3, genero: "masculino");

        Assert.Equal(3, categoria.Nivel);
        Assert.Equal("masculino", categoria.Genero);
        Assert.Null(categoria.Letra);
    }

    [Fact]
    public async Task Al_duplicar_un_tipo_se_reparten_las_letras_A_y_B()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "Letras 2");

        var primera = await CrearCategoriaAsync(client, torneo.Id, 3, "masculino");
        var segunda = await CrearCategoriaAsync(client, torneo.Id, 3, "masculino");

        Assert.Equal("B", segunda.Letra);

        // La primera, que nació sin letra, ha pasado a ser la "A".
        var detalle = await DetalleAsync(client, torneo.Id);
        Assert.Equal("A", detalle.Categorias.Single(c => c.Id == primera.Id).Letra);

        // Un tipo distinto (mismo nivel, otro género) no se ve afectado.
        var femenina = await CrearCategoriaAsync(client, torneo.Id, 3, "femenino");
        Assert.Null(femenina.Letra);
    }

    [Fact]
    public async Task Borrar_una_categoria_no_reasigna_letras_y_la_siguiente_continua()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "Letras 3");

        await CrearCategoriaAsync(client, torneo.Id, 2, "mixto");        // → A (al crear la B)
        var b = await CrearCategoriaAsync(client, torneo.Id, 2, "mixto"); // B
        await CrearCategoriaAsync(client, torneo.Id, 2, "mixto");        // C

        var borrado = await client.DeleteAsync($"/api/admin/tournaments/{torneo.Id}/categories/{b.Id}");
        Assert.Equal(HttpStatusCode.NoContent, borrado.StatusCode);

        var detalle = await DetalleAsync(client, torneo.Id);
        Assert.Equal(["A", "C"], detalle.Categorias.Select(c => c.Letra).ToArray());

        // La nueva no rellena el hueco de la B: continúa tras la letra más alta.
        var nueva = await CrearCategoriaAsync(client, torneo.Id, 2, "mixto");
        Assert.Equal("D", nueva.Letra);
    }

    [Fact]
    public async Task Cambiar_el_tipo_de_una_categoria_recoloca_su_letra_en_el_grupo_destino()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "Letras 4");

        var tercera = await CrearCategoriaAsync(client, torneo.Id, 3, "femenino");
        var segunda = await CrearCategoriaAsync(client, torneo.Id, 2, "femenino");

        // "Segunda femenino" pasa a "Tercera femenino": el grupo destino ya tiene
        // una (sin letra), así que esa pasa a A y la movida entra como B.
        var respuesta = await client.PutAsJsonAsync(
            $"/api/admin/tournaments/{torneo.Id}/categories/{segunda.Id}",
            new { nivel = 3, genero = "femenino" });
        Assert.Equal(HttpStatusCode.NoContent, respuesta.StatusCode);

        var detalle = await DetalleAsync(client, torneo.Id);
        Assert.Equal("A", detalle.Categorias.Single(c => c.Id == tercera.Id).Letra);
        var movida = detalle.Categorias.Single(c => c.Id == segunda.Id);
        Assert.Equal(3, movida.Nivel);
        Assert.Equal("B", movida.Letra);
    }

    [Fact]
    public async Task Una_categoria_invalida_devuelve_400()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "Inválidas");

        var nivelCero = await client.PostAsJsonAsync(
            $"/api/admin/tournaments/{torneo.Id}/categories", new { nivel = 0, genero = "masculino" });
        var generoMalo = await client.PostAsJsonAsync(
            $"/api/admin/tournaments/{torneo.Id}/categories", new { nivel = 1, genero = "infantil" });

        Assert.Equal(HttpStatusCode.BadRequest, nivelCero.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, generoMalo.StatusCode);
    }

    [Fact]
    public async Task Operar_sobre_torneos_o_categorias_inexistentes_devuelve_404()
    {
        var client = await ClienteAutenticadoAsync();
        var torneo = await CrearTorneoAsync(client, "404");

        var categoriaEnTorneoInexistente = await client.PostAsJsonAsync(
            "/api/admin/tournaments/9999/categories", new { nivel = 1, genero = "mixto" });
        var borrarCategoriaAjena = await client.DeleteAsync(
            $"/api/admin/tournaments/{torneo.Id}/categories/9999");
        var editarTorneoInexistente = await client.PutAsJsonAsync(
            "/api/admin/tournaments/9999", TorneoValido("X"));

        Assert.Equal(HttpStatusCode.NotFound, categoriaEnTorneoInexistente.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, borrarCategoriaAjena.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, editarTorneoInexistente.StatusCode);
    }
}
