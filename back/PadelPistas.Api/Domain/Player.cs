namespace PadelPistas.Api.Domain;

/// <summary>
/// Jugador dado de alta por el club. Sus históricos (torneos en los que ha
/// participado y partidos por torneo) no se almacenan aquí: se derivan de sus
/// <see cref="Registration"/> y de los <see cref="TournamentMatch"/> asociados.
/// </summary>
public class Player
{
    public int Id { get; set; }

    public required string Nombre { get; set; }

    /// <summary>Teléfonos de contacto (uno o varios). EF los persiste como JSON.</summary>
    public List<string> Telefonos { get; set; } = [];
}
