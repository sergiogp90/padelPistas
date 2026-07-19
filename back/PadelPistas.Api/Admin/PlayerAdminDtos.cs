namespace PadelPistas.Api.Admin;

// DTOs de jugadores e inscripciones del panel de administración (misma filosofía
// que TournamentAdminDtos.cs). El estado de una inscripción viaja como texto en
// minúsculas ("pendiente" / "aceptada" / "rechazada" / "retirada"), espejo de
// RegistrationStatus.

/// <summary>Alta o edición de un jugador.</summary>
public sealed record SavePlayerRequest(string Nombre, List<string>? Telefonos);

public sealed record PlayerResponse(int Id, string Nombre, IReadOnlyList<string> Telefonos);

/// <summary>Histórico de un jugador: torneos en los que participa y sus partidos.</summary>
public sealed record PlayerHistoryResponse(int Id, string Nombre, IReadOnlyList<PlayerTournamentHistory> Torneos);

public sealed record PlayerTournamentHistory(
    int TorneoId,
    string TorneoNombre,
    CategoryResponse Categoria,
    string Estado,
    IReadOnlyList<PlayerMatchHistory> Partidos);

/// <summary><c>Ganado</c> es <c>null</c> mientras el partido no tenga ganador.</summary>
public sealed record PlayerMatchHistory(
    int Id,
    DateTime? FechaHora,
    string? Resultado,
    bool? Ganado,
    IReadOnlyList<string> Rivales);

/// <summary>
/// Referencia a un jugador al inscribir una pareja: o bien uno existente (por
/// <c>Id</c>) o bien uno nuevo inline (por <c>Nombre</c> y opcionalmente teléfonos).
/// </summary>
public sealed record RegistrationPlayerRef(int? Id, string? Nombre, List<string>? Telefonos);

public sealed record CreateRegistrationRequest(RegistrationPlayerRef? Jugador1, RegistrationPlayerRef? Jugador2);

public sealed record UpdateRegistrationStatusRequest(string Estado);

public sealed record UpdateRegistrationPaymentRequest(bool Pagada);

public sealed record AvailabilitySlotDto(DateOnly Fecha, int Hora);

public sealed record UpdateAvailabilityRequest(List<AvailabilitySlotDto>? Slots);

public sealed record RegistrationResponse(
    int Id,
    int CategoryId,
    PlayerResponse Jugador1,
    PlayerResponse Jugador2,
    string Estado,
    bool Pagada,
    IReadOnlyList<AvailabilitySlotDto> Disponibilidad);

/// <summary>Resultado de crear una inscripción: o <c>Value</c> o un error tipado.</summary>
public sealed record RegistrationResult(RegistrationResponse? Value, AdminErrorKind? Error = null, string? Message = null);

public enum AdminErrorKind
{
    NotFound,
    Invalid,
    Duplicate,
}

public enum PlayerDeleteResult
{
    Deleted,
    NotFound,
    /// <summary>Tiene inscripciones: borrar rompería históricos (la BD lo bloquea con Restrict).</summary>
    InUse,
}
