namespace PadelPistas.Api.Admin;

// DTOs de las peticiones del panel de administración. Son distintos del contrato
// de lectura (Contracts/ApiContract.cs): ese lo consume el front y no debe cambiar
// por necesidades de escritura. El partido, en cambio, sí reutiliza ApiMatch como
// cuerpo (es exactamente la forma que se quiere fijar en la pista).

/// <summary>Alta de una pista nueva.</summary>
public sealed record CreateCourtRequest(string Nombre);

/// <summary>Renombrado de una pista existente.</summary>
public sealed record RenameCourtRequest(string Nombre);

/// <summary>Reordenación de pistas: ids en el orden deseado.</summary>
public sealed record ReorderCourtsRequest(int[] OrderedIds);

/// <summary>Credenciales de acceso del administrador.</summary>
public sealed record LoginRequest(string Email, string Password);
