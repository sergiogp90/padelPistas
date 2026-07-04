// Orquestador de Aspire: define los recursos de la aplicación distribuida y los
// arranca juntos en desarrollo (con el dashboard de Aspire). De momento solo hay
// un recurso: la API propia. El destino de despliegue (Azure Container Apps vía
// azd) se apoya en este AppHost. Ver ADR 0004.
var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.PadelPistas_Api>("api");

builder.Build().Run();
