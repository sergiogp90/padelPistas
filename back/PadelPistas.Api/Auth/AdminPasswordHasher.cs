using System.Security.Cryptography;

namespace PadelPistas.Api.Auth;

/// <summary>
/// Hash de contraseña con PBKDF2 (SHA-256), sin dependencias externas. El formato
/// almacenado es "{iteraciones}.{salt-base64}.{hash-base64}", autocontenido para
/// poder verificar sin más configuración. Genera un hash con:
/// <c>dotnet run --project PadelPistas.Api -- hash "tu-contraseña"</c>.
/// </summary>
public static class AdminPasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int KeySize = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }

    public static bool Verify(string hash, string password)
    {
        var parts = hash.Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations))
            return false;

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[1]);
            expected = Convert.FromBase64String(parts[2]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
