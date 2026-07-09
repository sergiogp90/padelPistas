using PadelPistas.Api.Contracts;
using PadelPistas.Api.Storage;

namespace PadelPistas.Api.Tests;

// Tests propios de la semilla en memoria (los que sí dependen de datos concretos).
public class InMemoryCourtStoreTests
{
    [Fact]
    public async Task Siembra_las_tres_pistas_de_ejemplo()
    {
        var courts = await new InMemoryCourtStore().GetAllAsync();

        Assert.Equal(3, courts.Count);
    }

    [Fact]
    public async Task La_pista_libre_no_tiene_partido()
    {
        var court = await new InMemoryCourtStore().GetByIdAsync(3);

        Assert.NotNull(court);
        Assert.Null(court.Match);
    }

    [Fact]
    public async Task Cubre_el_punto_de_ventaja_en_la_semilla()
    {
        var court = await new InMemoryCourtStore().GetByIdAsync(2);

        Assert.NotNull(court?.Match);
        Assert.Contains(ApiPoint.Advantage, court.Match.Score.CurrentPoint);
    }
}
