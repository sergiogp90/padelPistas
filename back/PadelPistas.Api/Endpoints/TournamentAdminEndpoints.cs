using PadelPistas.Api.Admin;

namespace PadelPistas.Api.Endpoints;

/// <summary>
/// Endpoints de torneos y categorías del panel de administración, bajo
/// <c>/api/admin/tournaments</c> y protegidos por autenticación. La lectura
/// también es privada: los torneos no forman parte (aún) del contrato público.
/// </summary>
public static class TournamentAdminEndpoints
{
    public static void MapTournamentAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/tournaments").RequireAuthorization();

        group.MapGet("", (ITournamentAdminService admin, CancellationToken ct) => admin.GetAllAsync(ct));

        group.MapGet("/{id:int}", async (int id, ITournamentAdminService admin, CancellationToken ct) =>
            await admin.GetByIdAsync(id, ct) is { } torneo ? Results.Ok(torneo) : Results.NotFound());

        group.MapPost("", async (SaveTournamentRequest request, ITournamentAdminService admin, CancellationToken ct) =>
        {
            if (TournamentValidation.Validate(request) is { } error)
                return Results.BadRequest(error);

            var torneo = await admin.CreateAsync(request, ct);
            return Results.Created($"/api/admin/tournaments/{torneo.Id}", torneo);
        });

        group.MapPut("/{id:int}", async (int id, SaveTournamentRequest request, ITournamentAdminService admin, CancellationToken ct) =>
        {
            if (TournamentValidation.Validate(request) is { } error)
                return Results.BadRequest(error);

            return await admin.UpdateAsync(id, request, ct) ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id:int}", async (int id, ITournamentAdminService admin, CancellationToken ct) =>
            await admin.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        group.MapPost("/{id:int}/categories", async (int id, SaveCategoryRequest request, ITournamentAdminService admin, CancellationToken ct) =>
        {
            if (TournamentValidation.ValidateCategoria(request, out var nivel, out var genero) is { } error)
                return Results.BadRequest(error);

            var creada = await admin.AddCategoryAsync(id, nivel, genero, ct);
            return creada is null
                ? Results.NotFound()
                : Results.Created($"/api/admin/tournaments/{id}", creada);
        });

        group.MapPut("/{id:int}/categories/{categoryId:int}", async (int id, int categoryId, SaveCategoryRequest request, ITournamentAdminService admin, CancellationToken ct) =>
        {
            if (TournamentValidation.ValidateCategoria(request, out var nivel, out var genero) is { } error)
                return Results.BadRequest(error);

            return await admin.UpdateCategoryAsync(id, categoryId, nivel, genero, ct)
                ? Results.NoContent()
                : Results.NotFound();
        });

        group.MapDelete("/{id:int}/categories/{categoryId:int}", async (int id, int categoryId, ITournamentAdminService admin, CancellationToken ct) =>
            await admin.DeleteCategoryAsync(id, categoryId, ct) ? Results.NoContent() : Results.NotFound());
    }
}
