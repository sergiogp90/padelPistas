using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;
using PadelPistas.Api.Admin;
using PadelPistas.Api.Auth;

namespace PadelPistas.Api.Endpoints;

/// <summary>Autenticación del administrador por cookie (login/logout/quién soy).</summary>
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (LoginRequest request, IOptions<AdminOptions> options, HttpContext http) =>
        {
            var admin = options.Value;
            var ok = !string.IsNullOrEmpty(admin.Email)
                && !string.IsNullOrEmpty(admin.PasswordHash)
                && string.Equals(request.Email, admin.Email, StringComparison.OrdinalIgnoreCase)
                && AdminPasswordHasher.Verify(admin.PasswordHash, request.Password);

            if (!ok) return Results.Unauthorized();

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, admin.Email), new Claim(ClaimTypes.Role, "admin")],
                CookieAuthenticationDefaults.AuthenticationScheme);
            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
            return Results.Ok(new { email = admin.Email });
        });

        group.MapPost("/logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });

        group.MapGet("/me", (HttpContext http) =>
            http.User.Identity?.IsAuthenticated == true
                ? Results.Ok(new { email = http.User.Identity.Name })
                : Results.Unauthorized());
    }
}
