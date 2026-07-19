using System.Net;
using System.Net.Http.Json;
using PadelPistas.Api.Admin;

namespace PadelPistas.Api.Tests;

// Integración de jugadores (/api/admin/players) e inscripciones
// (/api/admin/categories/{id}/registrations y /api/admin/registrations/{id}/…),
// reutilizando la Factory de AdminApiTests. Cada test monta su propio torneo y
// categoría para no interferir con los demás.
public class RegistrationAdminApiTests : IClassFixture<AdminApiTests.Factory>
{
    private readonly AdminApiTests.Factory _factory;

    public RegistrationAdminApiTests(AdminApiTests.Factory factory) => _factory = factory;

    private async Task<HttpClient> ClienteAutenticadoAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new { email = AdminApiTests.AdminEmail, password = AdminApiTests.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return client;
    }

    /// <summary>Torneo (7–13 sep) con una categoría; devuelve el id de la categoría.</summary>
    private static async Task<int> CrearCategoriaAsync(HttpClient client, string torneo)
    {
        var creado = await client.PostAsJsonAsync("/api/admin/tournaments", new
        {
            nombre = torneo,
            fechaInicio = "2026-09-07",
            fechaFin = "2026-09-13",
            inscripcionApertura = "2026-08-01T09:00:00",
            inscripcionCierre = "2026-09-01T23:59:00",
            pistasDisponibles = 3,
        });
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var torneoCreado = (await creado.Content.ReadFromJsonAsync<TournamentResponse>())!;

        var categoria = await client.PostAsJsonAsync(
            $"/api/admin/tournaments/{torneoCreado.Id}/categories", new { nivel = 3, genero = "masculino" });
        Assert.Equal(HttpStatusCode.Created, categoria.StatusCode);
        return (await categoria.Content.ReadFromJsonAsync<CategoryResponse>())!.Id;
    }

    private static async Task<PlayerResponse> CrearJugadorAsync(HttpClient client, string nombre, params string[] telefonos)
    {
        var response = await client.PostAsJsonAsync("/api/admin/players", new { nombre, telefonos });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PlayerResponse>())!;
    }

    private static async Task<RegistrationResponse> InscribirAsync(HttpClient client, int categoriaId, object jugador1, object jugador2)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/admin/categories/{categoriaId}/registrations", new { jugador1, jugador2 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RegistrationResponse>())!;
    }

    [Fact]
    public async Task Sin_autenticar_jugadores_e_inscripciones_devuelven_401()
    {
        var client = _factory.CreateClient();

        var jugadores = await client.GetAsync("/api/admin/players");
        var inscripciones = await client.GetAsync("/api/admin/categories/1/registrations");

        Assert.Equal(HttpStatusCode.Unauthorized, jugadores.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, inscripciones.StatusCode);
    }

    [Fact]
    public async Task Crear_y_buscar_jugadores_por_nombre_y_telefono()
    {
        var client = await ClienteAutenticadoAsync();
        await CrearJugadorAsync(client, "Fernando Belasteguín", "611000111");
        await CrearJugadorAsync(client, "Juan Lebrón", "622000222");

        var porNombre = await client.GetFromJsonAsync<PlayerResponse[]>("/api/admin/players?search=belaste");
        var porTelefono = await client.GetFromJsonAsync<PlayerResponse[]>("/api/admin/players?search=622000");

        Assert.Contains(porNombre!, p => p.Nombre == "Fernando Belasteguín");
        Assert.DoesNotContain(porNombre!, p => p.Nombre == "Juan Lebrón");
        Assert.Contains(porTelefono!, p => p.Nombre == "Juan Lebrón");
    }

    [Fact]
    public async Task Inscribir_una_pareja_con_jugadores_nuevos_inline()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Inscripciones 1");

        var inscripcion = await InscribirAsync(client, categoria,
            new { nombre = "Ana Torres", telefonos = new[] { "600111222" } },
            new { nombre = "Lucía Gil" });

        Assert.Equal("pendiente", inscripcion.Estado);
        Assert.False(inscripcion.Pagada);
        Assert.Empty(inscripcion.Disponibilidad);
        // Convención de pareja ordenada: el de menor id va primero.
        Assert.True(inscripcion.Jugador1.Id < inscripcion.Jugador2.Id);

        // Los jugadores creados inline existen como jugadores de pleno derecho.
        var jugador = await client.GetFromJsonAsync<PlayerResponse>($"/api/admin/players/{inscripcion.Jugador1.Id}");
        Assert.NotNull(jugador);
    }

    [Fact]
    public async Task Inscribir_mezclando_jugador_existente_y_nuevo_reutiliza_al_existente()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Inscripciones 2");
        var existente = await CrearJugadorAsync(client, "Carlos Vera", "633000333");

        var inscripcion = await InscribirAsync(client, categoria,
            new { id = existente.Id },
            new { nombre = "Diego Peña" });

        Assert.Contains(new[] { inscripcion.Jugador1.Id, inscripcion.Jugador2.Id }, id => id == existente.Id);
    }

    [Fact]
    public async Task La_misma_pareja_no_puede_inscribirse_dos_veces_ni_invirtiendo_el_orden()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Inscripciones 3");
        var a = await CrearJugadorAsync(client, "Uno");
        var b = await CrearJugadorAsync(client, "Dos");

        await InscribirAsync(client, categoria, new { id = a.Id }, new { id = b.Id });

        var invertida = await client.PostAsJsonAsync($"/api/admin/categories/{categoria}/registrations",
            new { jugador1 = new { id = b.Id }, jugador2 = new { id = a.Id } });

        Assert.Equal(HttpStatusCode.Conflict, invertida.StatusCode);
    }

    [Fact]
    public async Task Inscripciones_invalidas_devuelven_400_o_404()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Inscripciones 4");
        var a = await CrearJugadorAsync(client, "Solo");

        var mismoJugador = await client.PostAsJsonAsync($"/api/admin/categories/{categoria}/registrations",
            new { jugador1 = new { id = a.Id }, jugador2 = new { id = a.Id } });
        var jugadorInexistente = await client.PostAsJsonAsync($"/api/admin/categories/{categoria}/registrations",
            new { jugador1 = new { id = a.Id }, jugador2 = new { id = 9999 } });
        var sinNombre = await client.PostAsJsonAsync($"/api/admin/categories/{categoria}/registrations",
            new { jugador1 = new { id = a.Id }, jugador2 = new { } });
        var categoriaInexistente = await client.PostAsJsonAsync("/api/admin/categories/9999/registrations",
            new { jugador1 = new { id = a.Id }, jugador2 = new { nombre = "Otro" } });

        Assert.Equal(HttpStatusCode.BadRequest, mismoJugador.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, jugadorInexistente.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, sinNombre.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, categoriaInexistente.StatusCode);
    }

    [Fact]
    public async Task Cambiar_estado_y_pago_de_una_inscripcion()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Estados");
        var inscripcion = await InscribirAsync(client, categoria,
            new { nombre = "Pareja A1" }, new { nombre = "Pareja A2" });

        var aceptar = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/status",
            new { estado = "aceptada" });
        var pagar = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/payment",
            new { pagada = true });
        var estadoInvalido = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/status",
            new { estado = "expulsada" });

        Assert.Equal(HttpStatusCode.NoContent, aceptar.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, pagar.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, estadoInvalido.StatusCode);

        var lista = await client.GetFromJsonAsync<RegistrationResponse[]>(
            $"/api/admin/categories/{categoria}/registrations");
        var actual = Assert.Single(lista!);
        Assert.Equal("aceptada", actual.Estado);
        Assert.True(actual.Pagada);
    }

    [Fact]
    public async Task La_disponibilidad_se_guarda_y_se_valida_contra_las_fechas_del_torneo()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Disponibilidad");
        var inscripcion = await InscribirAsync(client, categoria,
            new { nombre = "Pareja B1" }, new { nombre = "Pareja B2" });

        var valida = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/availability",
            new { slots = new[] { new { fecha = "2026-09-07", hora = 18 }, new { fecha = "2026-09-08", hora = 19 } } });
        Assert.Equal(HttpStatusCode.NoContent, valida.StatusCode);

        var fueraDeRango = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/availability",
            new { slots = new[] { new { fecha = "2026-09-20", hora = 18 } } });
        var horaInvalida = await client.PutAsJsonAsync($"/api/admin/registrations/{inscripcion.Id}/availability",
            new { slots = new[] { new { fecha = "2026-09-07", hora = 24 } } });

        Assert.Equal(HttpStatusCode.BadRequest, fueraDeRango.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, horaInvalida.StatusCode);

        // El 400 no ha pisado la disponibilidad buena.
        var lista = await client.GetFromJsonAsync<RegistrationResponse[]>(
            $"/api/admin/categories/{categoria}/registrations");
        Assert.Equal(2, Assert.Single(lista!).Disponibilidad.Count);
    }

    [Fact]
    public async Task El_historico_del_jugador_recoge_sus_torneos()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Open Histórico");
        var inscripcion = await InscribirAsync(client, categoria,
            new { nombre = "Marta Ruiz" }, new { nombre = "Sara Soto" });

        var historico = await client.GetFromJsonAsync<PlayerHistoryResponse>(
            $"/api/admin/players/{inscripcion.Jugador1.Id}/history");

        Assert.NotNull(historico);
        var torneo = Assert.Single(historico.Torneos);
        Assert.Equal("Open Histórico", torneo.TorneoNombre);
        Assert.Equal("pendiente", torneo.Estado);
        Assert.Empty(torneo.Partidos); // los partidos llegarán con los cuadros
    }

    [Fact]
    public async Task Borrar_un_jugador_con_inscripciones_devuelve_409_y_libre_204()
    {
        var client = await ClienteAutenticadoAsync();
        var categoria = await CrearCategoriaAsync(client, "Borrados");
        var inscripcion = await InscribirAsync(client, categoria,
            new { nombre = "Con Inscripción" }, new { nombre = "Su Pareja" });
        var libre = await CrearJugadorAsync(client, "Sin Inscripción");

        var conflicto = await client.DeleteAsync($"/api/admin/players/{inscripcion.Jugador1.Id}");
        var borrado = await client.DeleteAsync($"/api/admin/players/{libre.Id}");

        Assert.Equal(HttpStatusCode.Conflict, conflicto.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, borrado.StatusCode);
    }
}
