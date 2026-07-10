using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Domain;

/// <summary>
/// Pista "normal" del club. El partido en curso se guarda como un <b>snapshot</b>
/// con la forma del contrato del cable (<see cref="ApiMatch"/>) en una columna
/// JSON: el marcador en vivo es intrínsecamente una foto puntual, así que
/// almacenarlo tal cual hace que el mapeo a <see cref="ApiCourt"/> sea directo y
/// mantiene intacto el contrato que el front ya consume. El modelado relacional
/// del partido (tabla propia con resultados) llegará con el dominio de torneos.
///
/// <see cref="CurrentMatch"/> == <c>null</c> representa una pista libre.
/// </summary>
public class Court
{
    public int Id { get; set; }

    public int ClubId { get; set; }

    public Club? Club { get; set; }

    public required string Nombre { get; set; }

    /// <summary>Orden de presentación de la pista (1, 2, 3…).</summary>
    public int Orden { get; set; }

    public ApiMatch? CurrentMatch { get; set; }
}
