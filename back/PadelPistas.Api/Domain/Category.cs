namespace PadelPistas.Api.Domain;

/// <summary>Género de una categoría de torneo.</summary>
public enum CategoryGender
{
    Masculino,
    Femenino,
    Mixto,
}

/// <summary>
/// Categoría de un torneo, identificada por nivel + género (p. ej. "Tercera
/// masculino"). Si un torneo tiene varias categorías del mismo nivel y género se
/// distinguen por <see cref="Letra"/> ("Tercera A", "Tercera B"…); la asignación
/// de letras es responsabilidad del servicio de administración, no del modelo.
/// </summary>
public class Category
{
    public int Id { get; set; }

    public int TournamentId { get; set; }

    public Tournament? Tournament { get; set; }

    /// <summary>Nivel de la categoría: 1 = Primera, 2 = Segunda, 3 = Tercera…</summary>
    public int Nivel { get; set; }

    public CategoryGender Genero { get; set; }

    /// <summary>
    /// Letra distintiva ("A", "B"…) cuando hay varias categorías del mismo
    /// nivel y género; <c>null</c> mientras la categoría sea única.
    /// </summary>
    public string? Letra { get; set; }

    public ICollection<Registration> Registrations { get; } = [];
}
