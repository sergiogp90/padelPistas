using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Admin;

/// <summary>
/// Operaciones de <b>escritura</b> del panel de administración sobre las pistas.
/// Separada de <see cref="Storage.ICourtStore"/> (solo lectura) para no contaminar
/// el contrato que el front consume: los endpoints públicos siguen dependiendo solo
/// de la lectura. Los métodos que actúan sobre una pista devuelven <c>false</c> si
/// no existe, para que el endpoint traduzca a 404.
/// </summary>
public interface ICourtAdminService
{
    Task<ApiCourt> CreateAsync(string nombre, CancellationToken ct = default);

    Task<bool> RenameAsync(int id, string nombre, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Fija o reemplaza el partido en curso (marcador incluido) de una pista.</summary>
    Task<bool> SetMatchAsync(int id, ApiMatch match, CancellationToken ct = default);

    /// <summary>Deja la pista libre (sin partido en curso).</summary>
    Task<bool> ClearMatchAsync(int id, CancellationToken ct = default);

    /// <summary>Reordena las pistas según el orden de <paramref name="orderedIds"/>.</summary>
    Task<bool> ReorderAsync(IReadOnlyList<int> orderedIds, CancellationToken ct = default);
}
