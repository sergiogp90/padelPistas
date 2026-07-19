using PadelPistas.Api.Domain;

namespace PadelPistas.Api.Admin;

// DTOs del área de torneos del panel de administración. Misma filosofía que
// AdminRequests.cs: separados del contrato de lectura de pistas. El género viaja
// como texto en minúsculas ("masculino" / "femenino" / "mixto"), espejo de
// CategoryGender; la conversión y su validación viven en los endpoints.

/// <summary>Alta o edición de un torneo (el cuerpo es el estado completo).</summary>
public sealed record SaveTournamentRequest(
    string Nombre,
    DateOnly FechaInicio,
    DateOnly FechaFin,
    DateTime InscripcionApertura,
    DateTime InscripcionCierre,
    int PistasDisponibles);

/// <summary>Alta o edición de una categoría. La letra nunca se envía: la asigna el servidor.</summary>
public sealed record SaveCategoryRequest(int Nivel, string Genero);

public sealed record TournamentResponse(
    int Id,
    string Nombre,
    DateOnly FechaInicio,
    DateOnly FechaFin,
    DateTime InscripcionApertura,
    DateTime InscripcionCierre,
    int PistasDisponibles,
    IReadOnlyList<CategoryResponse> Categorias);

public sealed record CategoryResponse(int Id, int Nivel, string Genero, string? Letra);

/// <summary>Validación de las reglas de un torneo; <c>null</c> si es válido.</summary>
public static class TournamentValidation
{
    public static string? Validate(SaveTournamentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nombre))
            return "El nombre del torneo es obligatorio.";
        if (request.FechaFin < request.FechaInicio)
            return "La fecha de fin no puede ser anterior a la de inicio.";
        if (request.InscripcionCierre < request.InscripcionApertura)
            return "El cierre de inscripciones no puede ser anterior a la apertura.";
        if (request.PistasDisponibles < 1)
            return "El torneo necesita al menos una pista disponible.";
        return null;
    }

    public static string? ValidateCategoria(SaveCategoryRequest request, out int nivel, out CategoryGender genero)
    {
        nivel = request.Nivel;
        genero = default;

        if (nivel < 1)
            return "El nivel debe ser 1 o mayor (1 = Primera, 2 = Segunda…).";
        if (!Enum.TryParse(request.Genero, ignoreCase: true, out genero))
            return "Género no válido: usa \"masculino\", \"femenino\" o \"mixto\".";
        return null;
    }
}
