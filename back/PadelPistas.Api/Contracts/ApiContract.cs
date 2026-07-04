using System.Text.Json.Serialization;

namespace PadelPistas.Api.Contracts;

// Contrato de la API propia: la forma del JSON tal como viaja por la red, antes
// de que el cliente lo traduzca a su dominio. Es el equivalente en C# de los
// tipos `Api*` de `front/src/data/apiContract.ts`, y DEBE serializar exactamente
// igual (camelCase en las propiedades; ver la configuración de JSON en Program.cs).
//
// El adaptador del cliente (`mapApiCourt`) valida el cable y rechaza cualquier
// valor fuera de contrato, así que aquí nos ceñimos a los mismos tokens.

/// <summary>Género del jugador. Serializa como "male" / "female".</summary>
[JsonConverter(typeof(JsonStringEnumConverter<ApiGender>))]
public enum ApiGender
{
    [JsonStringEnumMemberName("male")]
    Male,

    [JsonStringEnumMemberName("female")]
    Female,
}

/// <summary>
/// Punto del juego actual. En el cable viaja como número (0/15/30/40) o como la
/// cadena neutra "AD" para la ventaja; esa unión número/cadena la resuelve
/// <see cref="ApiPointJsonConverter"/>.
/// </summary>
[JsonConverter(typeof(ApiPointJsonConverter))]
public enum ApiPoint
{
    Love,
    Fifteen,
    Thirty,
    Forty,
    Advantage,
}

public sealed record ApiPlayer(string Name, ApiGender Gender);

public sealed record ApiTeam(ApiPlayer[] Players);

// currentPoint: punto actual de cada equipo [local, visitante].
// games: una pareja [local, visitante] por cada set jugado o en curso.
// sets: sets ganados por cada equipo [local, visitante].
public sealed record ApiScore(
    ApiPoint[] CurrentPoint,
    int[][] Games,
    int[] Sets);

public sealed record ApiMatch(
    ApiTeam[] Teams,
    ApiScore Score);

// Match es null cuando la pista no tiene partido en curso.
public sealed record ApiCourt(
    int Id,
    string Name,
    ApiMatch? Match);
