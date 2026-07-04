using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Storage;

/// <summary>
/// Almacén en memoria con datos sembrados fijos. El estado NO avanza solo: la
/// simulación de un partido en curso era una característica del mock del front;
/// con datos reales el marcador solo cambiará cuando lo edite el panel de
/// operador (aún por construir). Ver ADR 0004.
/// </summary>
public sealed class InMemoryCourtStore : ICourtStore
{
    private readonly IReadOnlyList<ApiCourt> _courts = Seed();

    public Task<IReadOnlyList<ApiCourt>> GetAllAsync(CancellationToken ct = default) =>
        Task.FromResult(_courts);

    public Task<ApiCourt?> GetByIdAsync(int id, CancellationToken ct = default) =>
        Task.FromResult(_courts.FirstOrDefault(court => court.Id == id));

    private static IReadOnlyList<ApiCourt> Seed() =>
    [
        // Pista con partido en curso: set ganado (1-0) y segundo set en juego.
        new ApiCourt(1, "Pista Central", new ApiMatch(
            Teams:
            [
                new ApiTeam([new ApiPlayer("Ana", ApiGender.Female), new ApiPlayer("Lucía", ApiGender.Female)]),
                new ApiTeam([new ApiPlayer("Marta", ApiGender.Female), new ApiPlayer("Sara", ApiGender.Female)]),
            ],
            Score: new ApiScore(
                CurrentPoint: [ApiPoint.Thirty, ApiPoint.Forty],
                Games: [[6, 4], [3, 5]],
                Sets: [1, 0]))),

        // Otra pista con partido: ejemplo del token de ventaja ("AD").
        new ApiCourt(2, "Pista 2", new ApiMatch(
            Teams:
            [
                new ApiTeam([new ApiPlayer("Carlos", ApiGender.Male), new ApiPlayer("Javier", ApiGender.Male)]),
                new ApiTeam([new ApiPlayer("Diego", ApiGender.Male), new ApiPlayer("Pablo", ApiGender.Male)]),
            ],
            Score: new ApiScore(
                CurrentPoint: [ApiPoint.Advantage, ApiPoint.Forty],
                Games: [[5, 5]],
                Sets: [0, 0]))),

        // Pista libre: cubre el caso match == null del contrato.
        new ApiCourt(3, "Pista 3", Match: null),
    ];
}
