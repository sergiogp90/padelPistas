namespace PadelPistas.Api.Domain;

/// <summary>
/// Partido de torneo entre dos parejas inscritas. Modelo mínimo y preparatorio:
/// hoy solo da soporte al histórico de partidos por torneo del jugador; los
/// partidos se crearán cuando exista la generación de cuadros (hito futuro), que
/// ampliará esta entidad (ronda, pista, enlace con el marcador en vivo…).
/// </summary>
public class TournamentMatch
{
    public int Id { get; set; }

    public int CategoryId { get; set; }

    public Category? Category { get; set; }

    public int Registration1Id { get; set; }

    public Registration? Registration1 { get; set; }

    public int Registration2Id { get; set; }

    public Registration? Registration2 { get; set; }

    public DateTime? FechaHora { get; set; }

    /// <summary>Resultado en texto (p. ej. "6-3 6-4"); <c>null</c> si aún no se jugó.</summary>
    public string? Resultado { get; set; }

    /// <summary>Id de la <see cref="Registration"/> vencedora; <c>null</c> si aún no se jugó.</summary>
    public int? GanadorId { get; set; }
}
