using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Data;
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

// Persistencia real detrás de la interfaz (ADR 0004): EF Core sobre SQLite en
// desarrollo, con proveedor intercambiable a Azure SQL/Postgres más adelante sin
// tocar los endpoints. InMemoryCourtStore se conserva como fallback y para tests.
var connectionString = builder.Configuration.GetConnectionString("PadelPistas")
    ?? "Data Source=padelpistas.db";
builder.Services.AddDbContext<PadelPistasDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<ICourtStore, EfCourtStore>();

var app = builder.Build();

// Aplica las migraciones al arrancar: crea la base de datos SQLite si no existe y
// siembra las pistas iniciales. En el entorno de tests el almacén se sustituye y no
// hay base de datos que migrar, así que se omite.
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PadelPistasDbContext>();
    db.Database.Migrate();
}

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
