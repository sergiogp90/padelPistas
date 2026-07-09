using System.Text.Json;
using PadelPistas.Api.Contracts;

namespace PadelPistas.Api.Tests;

// El conversor es el punto más frágil del contrato: une número y cadena en un
// mismo campo. Verificamos ambas direcciones y que rechaza lo que no es contrato.
public class ApiPointJsonConverterTests
{
    [Theory]
    [InlineData(ApiPoint.Love, "0")]
    [InlineData(ApiPoint.Fifteen, "15")]
    [InlineData(ApiPoint.Thirty, "30")]
    [InlineData(ApiPoint.Forty, "40")]
    [InlineData(ApiPoint.Advantage, "\"AD\"")]
    public void Write_emite_el_token_del_contrato(ApiPoint point, string expectedJson)
    {
        Assert.Equal(expectedJson, JsonSerializer.Serialize(point));
    }

    [Theory]
    [InlineData("0", ApiPoint.Love)]
    [InlineData("15", ApiPoint.Fifteen)]
    [InlineData("30", ApiPoint.Thirty)]
    [InlineData("40", ApiPoint.Forty)]
    [InlineData("\"AD\"", ApiPoint.Advantage)]
    public void Read_acepta_los_tokens_del_contrato(string json, ApiPoint expected)
    {
        Assert.Equal(expected, JsonSerializer.Deserialize<ApiPoint>(json));
    }

    [Theory]
    [InlineData("99")]      // número fuera de contrato
    [InlineData("\"XY\"")]  // cadena que no es "AD"
    [InlineData("true")]    // token de tipo no válido
    public void Read_rechaza_valores_fuera_de_contrato(string json)
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ApiPoint>(json));
    }
}
