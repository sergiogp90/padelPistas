namespace PadelPistas.Api.Domain;

/// <summary>
/// Club de pádel dueño de las pistas. En M1 hay uno solo (sembrado), pero el
/// modelo ya lleva la relación con <see cref="Court"/> por <c>ClubId</c> para
/// soportar varios clubes en hitos posteriores (multi-club).
/// </summary>
public class Club
{
    public int Id { get; set; }

    public required string Nombre { get; set; }

    /// <summary>Identificador legible y único del club (p. ej. "lgancce").</summary>
    public required string Slug { get; set; }

    public ICollection<Court> Courts { get; } = [];

    public ICollection<Tournament> Tournaments { get; } = [];
}
