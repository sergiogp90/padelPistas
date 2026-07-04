using System.Text.Json;
using System.Text.Json.Serialization;

namespace PadelPistas.Api.Contracts;

/// <summary>
/// Serializa <see cref="ApiPoint"/> como la unión del contrato: un número
/// (0/15/30/40) o la cadena "AD" para la ventaja. Al leer acepta ambos tokens y
/// lanza <see cref="JsonException"/> ante cualquier otro valor, para no dejar
/// pasar un punto fuera de contrato (el cliente lo rechazaría igualmente).
/// </summary>
public sealed class ApiPointJsonConverter : JsonConverter<ApiPoint>
{
    public override ApiPoint Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.String:
                var text = reader.GetString();
                return text == "AD"
                    ? ApiPoint.Advantage
                    : throw new JsonException($"Punto no válido: \"{text}\". Se esperaba 0, 15, 30, 40 o \"AD\".");

            case JsonTokenType.Number:
                return reader.GetInt32() switch
                {
                    0 => ApiPoint.Love,
                    15 => ApiPoint.Fifteen,
                    30 => ApiPoint.Thirty,
                    40 => ApiPoint.Forty,
                    var other => throw new JsonException($"Punto no válido: {other}. Se esperaba 0, 15, 30, 40 o \"AD\"."),
                };

            default:
                throw new JsonException($"Token no válido para el punto: {reader.TokenType}.");
        }
    }

    public override void Write(Utf8JsonWriter writer, ApiPoint value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case ApiPoint.Love:
                writer.WriteNumberValue(0);
                break;
            case ApiPoint.Fifteen:
                writer.WriteNumberValue(15);
                break;
            case ApiPoint.Thirty:
                writer.WriteNumberValue(30);
                break;
            case ApiPoint.Forty:
                writer.WriteNumberValue(40);
                break;
            case ApiPoint.Advantage:
                writer.WriteStringValue("AD");
                break;
            default:
                throw new JsonException($"ApiPoint no soportado: {value}.");
        }
    }
}
