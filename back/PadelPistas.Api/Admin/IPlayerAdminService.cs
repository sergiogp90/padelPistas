namespace PadelPistas.Api.Admin;

/// <summary>
/// Jugadores del club para el panel de administración: CRUD con búsqueda (para
/// reutilizar jugadores al inscribir parejas) e histórico derivado de sus
/// inscripciones y partidos.
/// </summary>
public interface IPlayerAdminService
{
    /// <summary>Lista jugadores; con <paramref name="search"/> filtra por nombre o teléfono.</summary>
    Task<IReadOnlyList<PlayerResponse>> SearchAsync(string? search, CancellationToken ct = default);

    Task<PlayerResponse?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<PlayerResponse> CreateAsync(SavePlayerRequest request, CancellationToken ct = default);

    Task<bool> UpdateAsync(int id, SavePlayerRequest request, CancellationToken ct = default);

    Task<PlayerDeleteResult> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Torneos en los que participa y, por torneo, sus partidos.</summary>
    Task<PlayerHistoryResponse?> GetHistoryAsync(int id, CancellationToken ct = default);
}
