using System.Text.Json;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using PadelPistas.Api.Admin;
using PadelPistas.Api.Auth;
using PadelPistas.Api.Data;
using PadelPistas.Api.Endpoints;
using PadelPistas.Api.Storage;

// Utilidad de línea de comandos para generar el hash de una contraseña de admin:
//   dotnet run --project PadelPistas.Api -- hash "tu-contraseña"
// Sale antes de construir la app web (no arranca el servidor).
if (args is ["hash", var passwordToHash])
{
    Console.WriteLine(AdminPasswordHasher.Hash(passwordToHash));
    return;
}

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

// Escritura del panel de administración (separada del contrato de lectura).
builder.Services.AddScoped<ICourtAdminService, CourtAdminService>();

// Administrador único por configuración (sección "Admin"): sin tabla de usuarios en M1.
builder.Services.Configure<AdminOptions>(builder.Configuration.GetSection(AdminOptions.SectionName));

// Autenticación por cookie. Al servirse todo desde un mismo origen, la cookie es
// same-origin y basta con SameSite=Lax. Ante peticiones no autenticadas a la API
// se responde 401/403 en vez de redirigir a una página de login.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "padelpistas.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

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

// "Un solo origen" (ADR 0004): sirve los estáticos de wwwroot. El front se copia en
// la raíz (se ve en "/") y el admin en wwwroot/admin (se ve en "/admin"); ver la
// diana MSBuild "BuildSpa" del .csproj, que los compila y copia al publicar. En
// desarrollo se usan los dev servers de Vite y wwwroot está vacío (no pasa nada).
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Endpoints de salud de Aspire (/health y /alive en desarrollo).
app.MapDefaultEndpoints();

// Contrato de solo lectura que el front consume por polling (ADR 0003 y 0004).
app.MapGet("/api/courts", (ICourtStore store, CancellationToken ct) => store.GetAllAsync(ct));

app.MapGet("/api/courts/{id:int}", async (int id, ICourtStore store, CancellationToken ct) =>
    await store.GetByIdAsync(id, ct) is { } court ? Results.Ok(court) : Results.NotFound());

// Autenticación del administrador y escritura del panel (protegida).
app.MapAuthEndpoints();
app.MapAdminEndpoints();

// Fallback de las SPAs (enrutado en cliente): cualquier ruta que no sea un fichero
// ni un endpoint cae en el index.html correspondiente. La regla de /admin es más
// específica y gana sobre la del front. No afecta a /api ni a los estáticos.
app.MapFallbackToFile("/admin/{*path:nonfile}", "admin/index.html");
app.MapFallbackToFile("{*path:nonfile}", "index.html");

app.Run();

// Marcador para que WebApplicationFactory<Program> pueda referenciar el arranque
// con top-level statements desde el proyecto de tests. No cambia el comportamiento.
public partial class Program { }
