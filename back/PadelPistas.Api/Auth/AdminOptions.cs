namespace PadelPistas.Api.Auth;

/// <summary>
/// Credenciales del administrador único, leídas de configuración (sección "Admin").
/// En M1 no hay tabla de usuarios: hay un solo administrador definido por config
/// (en dev, appsettings.Development.json; en prod, variables de entorno/secretos).
/// </summary>
public sealed class AdminOptions
{
    public const string SectionName = "Admin";

    public string Email { get; set; } = "";

    /// <summary>Hash PBKDF2 de la contraseña (ver <see cref="AdminPasswordHasher"/>).</summary>
    public string PasswordHash { get; set; } = "";
}
