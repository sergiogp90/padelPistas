using PadelPistas.Api.Admin;

namespace PadelPistas.Api.Endpoints;

/// <summary>
/// Endpoints de jugadores del panel de administración, bajo <c>/api/admin/players</c>
/// y protegidos por autenticación.
/// </summary>
public static class PlayerAdminEndpoints
{
    public static void MapPlayerAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/players").RequireAuthorization();

        group.MapGet("", (string? search, IPlayerAdminService admin, CancellationToken ct) =>
            admin.SearchAsync(search, ct));

        group.MapGet("/{id:int}", async (int id, IPlayerAdminService admin, CancellationToken ct) =>
            await admin.GetByIdAsync(id, ct) is { } jugador ? Results.Ok(jugador) : Results.NotFound());

        group.MapGet("/{id:int}/history", async (int id, IPlayerAdminService admin, CancellationToken ct) =>
            await admin.GetHistoryAsync(id, ct) is { } historico ? Results.Ok(historico) : Results.NotFound());

        group.MapPost("", async (SavePlayerRequest request, IPlayerAdminService admin, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nombre))
                return Results.BadRequest("El nombre del jugador es obligatorio.");

            var jugador = await admin.CreateAsync(request, ct);
            return Results.Created($"/api/admin/players/{jugador.Id}", jugador);
        });

        group.MapPut("/{id:int}", async (int id, SavePlayerRequest request, IPlayerAdminService admin, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nombre))
                return Results.BadRequest("El nombre del jugador es obligatorio.");

            return await admin.UpdateAsync(id, request, ct) ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id:int}", async (int id, IPlayerAdminService admin, CancellationToken ct) =>
            await admin.DeleteAsync(id, ct) switch
            {
                PlayerDeleteResult.Deleted => Results.NoContent(),
                PlayerDeleteResult.InUse => Results.Conflict(
                    "No se puede borrar: el jugador tiene inscripciones (su histórico depende de ellas)."),
                _ => Results.NotFound(),
            });
    }
}
