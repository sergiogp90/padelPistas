using PadelPistas.Api.Admin;
using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Endpoints;

/// <summary>
/// Endpoints de inscripciones del panel de administración: el alta y el listado
/// cuelgan de la categoría (<c>/api/admin/categories/{id}/registrations</c>) y las
/// operaciones sobre una inscripción concreta van por su id global
/// (<c>/api/admin/registrations/{id}/…</c>).
/// </summary>
public static class RegistrationAdminEndpoints
{
    public static void MapRegistrationAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var porCategoria = app.MapGroup("/api/admin/categories/{categoryId:int}/registrations")
            .RequireAuthorization();

        porCategoria.MapGet("", async (int categoryId, IRegistrationAdminService admin, CancellationToken ct) =>
            await admin.GetForCategoryAsync(categoryId, ct) is { } inscripciones
                ? Results.Ok(inscripciones)
                : Results.NotFound());

        porCategoria.MapPost("", async (int categoryId, CreateRegistrationRequest request, IRegistrationAdminService admin, CancellationToken ct) =>
        {
            if (request.Jugador1 is null || request.Jugador2 is null)
                return Results.BadRequest("La inscripción necesita dos jugadores.");

            var resultado = await admin.CreateAsync(categoryId, request, ct);
            return resultado switch
            {
                { Value: { } inscripcion } => Results.Created($"/api/admin/registrations/{inscripcion.Id}", inscripcion),
                { Error: AdminErrorKind.NotFound } => Results.NotFound(),
                { Error: AdminErrorKind.Duplicate } => Results.Conflict(resultado.Message),
                _ => Results.BadRequest(resultado.Message),
            };
        });

        var porInscripcion = app.MapGroup("/api/admin/registrations").RequireAuthorization();

        porInscripcion.MapPut("/{id:int}/status", async (int id, UpdateRegistrationStatusRequest request, IRegistrationAdminService admin, CancellationToken ct) =>
        {
            if (!Enum.TryParse<RegistrationStatus>(request.Estado, ignoreCase: true, out var estado))
                return Results.BadRequest("Estado no válido: usa \"pendiente\", \"aceptada\", \"rechazada\" o \"retirada\".");

            return await admin.UpdateStatusAsync(id, estado, ct) ? Results.NoContent() : Results.NotFound();
        });

        porInscripcion.MapPut("/{id:int}/payment", async (int id, UpdateRegistrationPaymentRequest request, IRegistrationAdminService admin, CancellationToken ct) =>
            await admin.UpdatePaymentAsync(id, request.Pagada, ct) ? Results.NoContent() : Results.NotFound());

        porInscripcion.MapPut("/{id:int}/availability", async (int id, UpdateAvailabilityRequest request, IRegistrationAdminService admin, CancellationToken ct) =>
        {
            var (found, error) = await admin.UpdateAvailabilityAsync(id, request.Slots ?? [], ct);
            if (!found) return Results.NotFound();
            return error is null ? Results.NoContent() : Results.BadRequest(error);
        });

        porInscripcion.MapDelete("/{id:int}", async (int id, IRegistrationAdminService admin, CancellationToken ct) =>
            await admin.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());
    }
}
