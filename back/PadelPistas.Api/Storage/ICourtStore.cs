using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Storage;

/// <summary>
/// Acceso de solo lectura al estado de las pistas. El resto de la API (los
/// endpoints) depende solo de esta interfaz y no sabe si detrás hay memoria,
/// SQLite o almacenamiento de Azure (ver ADR 0004).
///
/// Es asíncrona a propósito desde el día uno —aunque la implementación en
/// memoria sea síncrona— para que migrar a un almacén de verdad asíncrono no
/// obligue a tocar a los llamadores. Devuelve el DTO del contrato
/// (<see cref="ApiCourt"/>), no una entidad de base de datos, para que el
/// endpoint no cambie según el almacén.
/// </summary>
public interface ICourtStore
{
    /// <summary>Estado de todas las pistas (<c>GET /api/courts</c>).</summary>
    Task<IReadOnlyList<ApiCourt>> GetAllAsync(CancellationToken ct = default);

    /// <summary>Estado de una pista, o <c>null</c> si no existe (<c>GET /api/courts/{id}</c>).</summary>
    Task<ApiCourt?> GetByIdAsync(int id, CancellationToken ct = default);
}
