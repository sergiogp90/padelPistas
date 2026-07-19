using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

/// <summary>
/// Lectura y escritura de torneos y sus categorías para el panel de
/// administración. Los métodos que devuelven <c>null</c>/<c>false</c> señalan
/// "no encontrado"; la validación de los cuerpos ocurre antes, en los endpoints.
/// </summary>
public interface ITournamentAdminService
{
    Task<IReadOnlyList<TournamentResponse>> GetAllAsync(CancellationToken ct = default);

    Task<TournamentResponse?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<TournamentResponse> CreateAsync(SaveTournamentRequest request, CancellationToken ct = default);

    Task<bool> UpdateAsync(int id, SaveTournamentRequest request, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Crea una categoría asignando la letra que toque; null si el torneo no existe.</summary>
    Task<CategoryResponse?> AddCategoryAsync(int tournamentId, int nivel, CategoryGender genero, CancellationToken ct = default);

    /// <summary>Cambia nivel/género de una categoría, recolocando su letra en el nuevo grupo.</summary>
    Task<bool> UpdateCategoryAsync(int tournamentId, int categoryId, int nivel, CategoryGender genero, CancellationToken ct = default);

    Task<bool> DeleteCategoryAsync(int tournamentId, int categoryId, CancellationToken ct = default);
}
