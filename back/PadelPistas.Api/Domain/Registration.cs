namespace PadelPistas.Api.Domain;

/// <summary>Estado de una inscripción dentro de su categoría.</summary>
public enum RegistrationStatus
{
    Pendiente,
    Aceptada,
    Rechazada,
    Retirada,
}

/// <summary>
/// Franja en la que la pareja puede jugar: un día del torneo y la hora de inicio
/// (0–23). La validación de que cae dentro del rango de fechas del torneo es
/// responsabilidad del servicio de administración.
/// </summary>
public record AvailabilitySlot(DateOnly Fecha, int Hora);

/// <summary>
/// Inscripción de una pareja en una categoría. Por convención los jugadores se
/// guardan ordenados (<c>Player1Id &lt; Player2Id</c>, reforzado con un CHECK en la
/// tabla): así la pareja (A, B) y la (B, A) son la misma fila y el índice único
/// por categoría impide inscribirla dos veces.
/// </summary>
public class Registration
{
    public int Id { get; set; }

    public int CategoryId { get; set; }

    public Category? Category { get; set; }

    public int Player1Id { get; set; }

    public Player? Player1 { get; set; }

    public int Player2Id { get; set; }

    public Player? Player2 { get; set; }

    public RegistrationStatus Estado { get; set; } = RegistrationStatus.Pendiente;

    public bool Pagada { get; set; }

    /// <summary>
    /// Disponibilidad declarada por la pareja para los días del torneo; base del
    /// futuro sorteo de turnos de juego. Se persiste como JSON (misma técnica que
    /// el snapshot de partido de <see cref="Court"/>).
    /// </summary>
    public List<AvailabilitySlot> Disponibilidad { get; set; } = [];
}
