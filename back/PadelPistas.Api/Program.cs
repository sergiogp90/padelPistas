using System.Text.Json;
using PadelPistas.Api.Storage;

var builder = WebApplication.CreateBuilder(args);

// Aspire: service discovery, health checks, telemetría y resiliencia por defecto.
builder.AddServiceDefaults();

// JSON del contrato: propiedades en camelCase, para emitir exactamente la forma
// que espera el cliente (front/src/data/apiContract.ts). Los enums NO llevan un
// conversor global: cada uno lleva el suyo por atributo de tipo (ApiGender ->
// "male"/"female"; ApiPoint -> 0/15/30/40/"AD"). Un conversor en esta colección
// tendría prioridad sobre esos atributos y rompería el contrato del punto.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

// Almacén tras la interfaz: hoy en memoria; mañana SqliteCourtStore/Azure cambiando
// solo esta línea (ver ADR 0004). Singleton porque el estado sembrado es compartido.
builder.Services.AddSingleton<ICourtStore, InMemoryCourtStore>();

var app = builder.Build();

// Endpoints de salud de Aspire (/health y /alive en desarrollo).
app.MapDefaultEndpoints();

// Contrato de solo lectura que el front consume por polling (ADR 0003 y 0004).
app.MapGet("/api/courts", (ICourtStore store, CancellationToken ct) => store.GetAllAsync(ct));

app.MapGet("/api/courts/{id:int}", async (int id, ICourtStore store, CancellationToken ct) =>
    await store.GetByIdAsync(id, ct) is { } court ? Results.Ok(court) : Results.NotFound());

// "Un solo origen" (ADR 0004): en un paso posterior este mismo host servirá el
// dist/ del front desde wwwroot, y el build de Vite se copiará ahí. Se deja
// preparado y comentado hasta montar ese pipeline de build.
// app.UseDefaultFiles();
// app.UseStaticFiles();
// app.MapFallbackToFile("index.html");

app.Run();

// Marcador para que WebApplicationFactory<Program> pueda referenciar el arranque
// con top-level statements desde el proyecto de tests. No cambia el comportamiento.
public partial class Program { }
