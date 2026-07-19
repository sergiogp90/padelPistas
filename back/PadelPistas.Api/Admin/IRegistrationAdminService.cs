namespace PadelPistas.Api.Admin;

/// <summary>
/// Inscripciones de parejas en una categoría: alta (con jugadores existentes o
/// nuevos inline), estado, pago y disponibilidad.
/// </summary>
public interface IRegistrationAdminService
{
    /// <summary><c>null</c> si la categoría no existe.</summary>
    Task<IReadOnlyList<RegistrationResponse>?> GetForCategoryAsync(int categoryId, CancellationToken ct = default);

    Task<RegistrationResult> CreateAsync(int categoryId, CreateRegistrationRequest request, CancellationToken ct = default);

    Task<bool> UpdateStatusAsync(int id, Domain.RegistrationStatus estado, CancellationToken ct = default);

    Task<bool> UpdatePaymentAsync(int id, bool pagada, CancellationToken ct = default);

    /// <summary>Reemplaza la disponibilidad; los slots deben caer en las fechas del torneo.</summary>
    Task<(bool Found, string? Error)> UpdateAvailabilityAsync(int id, List<AvailabilitySlotDto> slots, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
}
