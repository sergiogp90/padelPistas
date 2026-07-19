using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>
/// Mapeos entidad → DTO compartidos por los servicios del panel de administración.
/// Los enums salen como texto en minúsculas, igual que entran en los requests.
/// </summary>
internal static class AdminMapping
{
    public static CategoryResponse ToResponse(this Category categoria) =>
        new(categoria.Id, categoria.Nivel, categoria.Genero.ToString().ToLowerInvariant(), categoria.Letra);

    public static PlayerResponse ToResponse(this Player jugador) =>
        new(jugador.Id, jugador.Nombre, jugador.Telefonos);

    /// <summary>Requiere la inscripción cargada con Player1 y Player2.</summary>
    public static RegistrationResponse ToResponse(this Registration inscripcion) =>
        new(inscripcion.Id,
            inscripcion.CategoryId,
            inscripcion.Player1!.ToResponse(),
            inscripcion.Player2!.ToResponse(),
            inscripcion.Estado.ToString().ToLowerInvariant(),
            inscripcion.Pagada,
            inscripcion.Disponibilidad.Select(s => new AvailabilitySlotDto(s.Fecha, s.Hora)).ToList());
}
