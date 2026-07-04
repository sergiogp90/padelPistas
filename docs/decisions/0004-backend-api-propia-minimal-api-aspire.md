# ADR 0004 — Backend de la API propia: ASP.NET Core Minimal API + Aspire, almacén tras interfaz

- **Estado:** Aceptada
- **Fecha:** 2026-07-04
- **Hito:** M6 — Datos reales (implementación del backend que el cliente ya consume)
- **Contexto en el código:** contrato que debe cumplir el backend en
  `src/data/apiContract.ts` (front); el backend vivirá en `/back` tras la
  reestructuración del repo a monorepo (`/front` + `/back`).

## Contexto

El [ADR 0003](0003-fuente-de-datos-real-api-propia.md) decidió que la fuente de
datos real es una **API propia** de solo lectura consumida por **_polling_**, y
dejó el cliente completo: contrato (`apiContract.ts`), adaptador (`mapApiCourt`),
`ApiDataSource` con *backoff* y estado de conexión, y selección mock ⇄ API por
configuración. Pero ese ADR **no implementaba el backend**; su última línea lo
dejaba explícito: *«la API propia es un servicio aparte que debe cumplir el
contrato de `apiContract.ts`»*.

Este ADR registra el **cómo** de ese backend: con qué se construye, dónde vive,
cómo guarda el estado y cómo se despliega. El contrato de cable (endpoints y
forma del JSON) **no se rediseña**: ya está congelado en `apiContract.ts` y el
adaptador del cliente lo valida (p. ej. `mapPoint` lanza error ante un punto que
no sea `0|15|30|40|"AD"`). El backend se limita a **cumplirlo**.

Quedaban abiertas cuatro preguntas:

1. **¿Con qué stack** se construye el backend?
2. **¿Dónde vive** respecto al front y **cómo se despliega**?
3. **¿Cómo guarda el estado**, sabiendo que hoy basta memoria pero mañana puede
   querer persistencia?
4. **¿Se mantiene el _polling_** del ADR 0003 o el backend «avisa» al front?

## Decisión

### Stack: ASP.NET Core Minimal API, envuelta en .NET Aspire

El backend es una **ASP.NET Core Minimal API** en **.NET**. Se elige .NET porque
es el stack en el que el autor es más productivo y este es un proyecto para
**aprender SDLC**: trabajar en tecnología conocida deja el foco en las decisiones
de diseño. Una Minimal API encaja al milímetro con un contrato REST de solo
lectura (`GET /api/courts`, `GET /api/courts/:id`).

Se envuelve en **.NET Aspire** (proyecto *AppHost* + *ServiceDefaults*) por sus
*health checks*, resiliencia y **despliegue directo a Azure Container Apps** con
`azd`, alineado con el objetivo de aprender despliegue en nube con buenas
prácticas. Aspire **no** es el framework web: la API sigue siendo Minimal API por
debajo, y Aspire orquesta y despliega.

### Un solo origen: el host ASP.NET sirve el front

El front de Vite compila a **ficheros estáticos**. En lugar de servirlo como un
servicio vivo aparte, el host ASP.NET **sirve el `dist/` del front** (vía
`wwwroot` / `MapFallbackToFile`). Así front y API comparten **el mismo origen**:
`/api` resuelve solo, **sin CORS**, encajando con el `DEFAULT_API_BASE_URL = '/api'`
que el cliente ya trae por defecto. Se despliega **un único contenedor**.

### Almacén tras una interfaz (patrón *repository*), en memoria por ahora

El acceso al estado vive tras una interfaz `ICourtStore`; el resto del backend
(endpoints) depende solo de ella y no sabe si detrás hay memoria, SQLite o
almacenamiento de Azure. Es el **mismo movimiento** que el cliente hizo con
`DataSource` (esconder el origen tras una interfaz), aplicado aquí al
**almacenamiento**. Dos detalles hacen que el cambio futuro sea trivial:

- **Interfaz asíncrona desde el día uno** (`Task<...>`), aunque la implementación
  en memoria sea síncrona (`Task.FromResult`). SQLite y Azure *son* asíncronos;
  definirla ya `async` evita tener que tocar a todos los llamadores al migrar.
- **Devuelve el DTO del contrato** (`ApiCourt`), no una entidad de base de datos,
  de modo que el endpoint no cambia según el almacén.

Cambiar de almacén será una línea en el registro de dependencias
(`AddSingleton<ICourtStore, InMemoryCourtStore>()` → `AddScoped<..., SqliteCourtStore>()`).

### Datos: sembrados fijos, sin simulación; el único escritor será el panel

La primera rebanada sirve **datos sembrados fijos** desde `InMemoryCourtStore`.
El estado **no avanza solo**: la simulación de un partido que progresa era una
característica **del mock**, no del sistema real. Con datos reales, el marcador
**solo cambia cuando el panel de operador lo edita** (ese panel llegará después;
ver *pendiente* más abajo). Esto simplifica la primera entrega: no hace falta un
`BackgroundService` ni lógica de progreso de partido en el backend.

### Transporte: se mantiene el _polling_ del ADR 0003

Se **reafirma el _polling_** decidido en el ADR 0003; el backend **no «avisa»** al
front. Que el dato cambie poco (solo al editar el panel) **no penaliza el
_polling_, lo abarata**: la mayoría de sondeos devuelven lo mismo, que es barato.
El sondeo corto (5 s por defecto) da sensación de tiempo real sin reescribir el
cliente, que ya está construido para sondear con *backoff*.

## Alternativas descartadas

**Otro stack (Node/TS, Python, Go…).** Node permitía **reutilizar**
`apiContract.ts` y la lógica del mock tal cual (un solo lenguaje en el repo). Se
descarta frente a .NET porque la productividad del autor en .NET pesa más para un
proyecto de aprendizaje; el precio (reescribir el contrato como *records* de C#)
es pequeño porque el contrato es diminuto.

**Aspire con el front como servicio vivo aparte (dos contenedores) o repo
separado.** Modelar el front como un segundo servicio (nginx sirviendo el `dist`)
luce más «distribuido», pero reintroduce **CORS** y duplica piezas para nada,
dado que el front es estático. Un **repo aparte** para el backend duplicaría CI,
versionado y coordinación de despliegue; «servicio aparte» (ADR 0003) significa
**proceso** aparte, que el monorepo también cumple. Se elige **monorepo**
`/front` + `/back` y **un solo origen**.

**Que el backend «avise» al front (WebSocket / SSE / _push_).** Daría menos
latencia, pero **reabre justo la complejidad que el ADR 0003 evitó** en una TV
encendida días (mantener la conexión viva, reconexiones, *heartbeats*) y
**obligaría a reescribir** el `ApiDataSource`, hoy basado en *polling*. Si algún
día la latencia importara, el *push* se puede meter **dentro del `DataSource`**
sin tocar la escena ni la UI (lo prevé el propio ADR 0003).

**Leer «cada X minutos».** Al contrario que el *push*, se queda **demasiado
lento**: un punto marcado tardaría minutos en verse en el panel. Un panel «en
vivo» quiere el sondeo corto que ya existe.

**Simular en el backend un partido que avanza solo.** Sería arrastrar al servicio
real una característica que era **solo del mock**. El dato real lo produce el
operador; el backend no inventa progreso de partido.

**Persistencia completa (SQLite/Azure) desde el principio.** Innecesaria para una
primera rebanada cuyo estado son datos sembrados fijos. La interfaz `ICourtStore`
(async, devolviendo el DTO) deja la puerta abierta a migrar **sin tocar los
endpoints** cuando el panel de operador introduzca datos que sí convenga
conservar.

## Consecuencias

**A favor:**

- El backend se construye en el stack más productivo para el autor, con el foco
  en el diseño y no en el lenguaje.
- **Un solo origen** elimina el CORS y encaja con el `/api` que el cliente ya
  asume; se despliega una sola cosa.
- El almacén tras `ICourtStore` (async, con el DTO del contrato) hace que
  memoria → SQLite → Azure sea **un cambio en el registro de dependencias**, sin
  tocar endpoints; espeja la abstracción `DataSource` del cliente.
- Aspire aporta *health checks*, resiliencia y despliegue a **Azure Container
  Apps** con `azd`, cumpliendo el objetivo de aprender despliegue en nube.
- Se **reafirma el _polling_** sin reescribir el cliente; la baja frecuencia de
  cambios lo hace incluso más barato.

**En contra / a tener en cuenta:**

- Se **pierde la reutilización** directa de `apiContract.ts`: hay que reescribir
  el contrato como *records* de C#. En particular, `ApiPoint = 0|15|30|40|"AD"`
  es una **unión de número y cadena** que necesita un `JsonConverter` a medida
  para emitir exactamente esos tokens (el cliente rechaza cualquier otro valor).
- **Aspire es más maquinaria** que la mínima para una sola API pequeña; se asume
  por su valor de aprendizaje (observabilidad + despliegue), no por necesidad.
- El coste en Azure Container Apps **no es estrictamente 0** si el contenedor se
  mantiene «caliente» por el *polling* 24/7; con la TV apagada fuera de horario
  escala a cero. Para acotar peticiones conviene el **endpoint agregado**
  `GET /api/courts` (una llamada para todas las pistas), como ya anticipaba la
  sección de consecuencias del ADR 0003.

**Pendiente (fuera del alcance de este ADR):**

- El **panel de operador** que escribe el estado real (único productor del dato);
  al añadirlo se revisará la persistencia (SQLite/Azure) y el *lifetime* de DI.
- Ajuste opcional del cliente para tratar `304 Not Modified` (ETag) como «sin
  cambios» y abaratar aún más los sondeos.
- Migrar el cliente al endpoint agregado `GET /api/courts` si el número de pistas
  crece.
