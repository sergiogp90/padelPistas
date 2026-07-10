using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Admin;

/// <summary>
/// Valida la forma de un partido antes de persistirlo. Los tokens de punto ya los
/// valida <see cref="ApiPointJsonConverter"/> al deserializar; aquí comprobamos las
/// cardinalidades del pádel (2 equipos, 2 jugadores por equipo) y que el marcador
/// esté completo.
/// </summary>
public static class MatchValidation
{
    /// <summary>Devuelve el primer error encontrado, o <c>null</c> si el partido es válido.</summary>
    public static string? Validate(ApiMatch? match)
    {
        if (match is null) return null; // pista libre: válido

        if (match.Teams is not { Length: 2 })
            return "El partido debe tener exactamente 2 equipos.";

        foreach (var team in match.Teams)
        {
            if (team.Players is not { Length: 2 })
                return "Cada equipo debe tener exactamente 2 jugadores.";

            foreach (var player in team.Players)
                if (string.IsNullOrWhiteSpace(player.Name))
                    return "El nombre de cada jugador es obligatorio.";
        }

        var score = match.Score;
        if (score is null) return "El marcador es obligatorio.";
        if (score.CurrentPoint is not { Length: 2 }) return "currentPoint debe tener 2 valores.";
        if (score.Sets is not { Length: 2 }) return "sets debe tener 2 valores.";
        if (score.Games is null || score.Games.Any(g => g is not { Length: 2 }))
            return "Cada set en games debe tener 2 valores.";

        return null;
    }
}
