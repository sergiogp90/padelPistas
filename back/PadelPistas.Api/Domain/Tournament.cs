namespace PadelPistas.Api.Domain;

/// <summary>
/// Torneo organizado por un club. Las fechas de inicio/fin delimitan los días de
/// juego (y por tanto el calendario de disponibilidad de las parejas); la ventana
/// de apertura/cierre acota el plazo de inscripción.
/// </summary>
public class Tournament
{
    public int Id { get; set; }

    public int ClubId { get; set; }

    public Club? Club { get; set; }

    public required string Nombre { get; set; }

    public DateOnly FechaInicio { get; set; }

    public DateOnly FechaFin { get; set; }

    public DateTime InscripcionApertura { get; set; }

    public DateTime InscripcionCierre { get; set; }

    /// <summary>Nº de pistas del club reservadas para el torneo.</summary>
    public int PistasDisponibles { get; set; }

    public ICollection<Category> Categories { get; } = [];
}
