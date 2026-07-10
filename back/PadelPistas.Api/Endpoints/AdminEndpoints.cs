using PadelPistas.Api.Admin;
using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Endpoints;

/// <summary>
/// Endpoints de escritura del panel de administración, bajo <c>/api/admin/courts</c>
/// y protegidos por autenticación. Los endpoints de lectura (<c>/api/courts</c>)
/// siguen siendo públicos y viven en Program.cs.
/// </summary>
public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/courts").RequireAuthorization();

        group.MapPost("", async (CreateCourtRequest request, ICourtAdminService admin, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nombre))
                return Results.BadRequest("El nombre de la pista es obligatorio.");

            var court = await admin.CreateAsync(request.Nombre, ct);
            return Results.Created($"/api/courts/{court.Id}", court);
        });

        group.MapPut("/{id:int}", async (int id, RenameCourtRequest request, ICourtAdminService admin, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nombre))
                return Results.BadRequest("El nombre de la pista es obligatorio.");

            return await admin.RenameAsync(id, request.Nombre, ct) ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id:int}", async (int id, ICourtAdminService admin, CancellationToken ct) =>
            await admin.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        group.MapPut("/{id:int}/match", async (int id, ApiMatch match, ICourtAdminService admin, CancellationToken ct) =>
        {
            if (MatchValidation.Validate(match) is { } error)
                return Results.BadRequest(error);

            return await admin.SetMatchAsync(id, match, ct) ? Results.NoContent() : Results.NotFound();
        });

        group.MapDelete("/{id:int}/match", async (int id, ICourtAdminService admin, CancellationToken ct) =>
            await admin.ClearMatchAsync(id, ct) ? Results.NoContent() : Results.NotFound());

        group.MapPost("/reorder", async (ReorderCourtsRequest request, ICourtAdminService admin, CancellationToken ct) =>
        {
            if (request.OrderedIds is null || request.OrderedIds.Length == 0)
                return Results.BadRequest("Se requiere la lista de ids ordenados.");

            return await admin.ReorderAsync(request.OrderedIds, ct)
                ? Results.NoContent()
                : Results.BadRequest("Algún id no existe.");
        });
    }
}
