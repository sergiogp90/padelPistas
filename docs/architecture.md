# Arquitectura

> Documento vivo con las decisiones técnicas del proyecto y su porqué. Se
> actualiza por Pull Request a medida que el proyecto evoluciona.

## Stack

- **Three.js** — render 3D sobre WebGL.
- **Vite** — servidor de desarrollo y bundler.
- **TypeScript** — tipado estático del dominio y la lógica.

## Estructura de carpetas (objetivo)

```
src/
  types/    Tipos del dominio (Court, Match, Team, Player, Score)
  data/     Fuentes de datos (mock hoy; interfaz DataSource en M2)
  scene/    Escena 3D y render multipista:
              PadelCourt          pista 3D reutilizable
              CourtView           una pista autocontenida (escena + cámara + marcador)
              gridLayout          aritmética de la rejilla de celdas (sin Three.js/DOM)
              MultiCourtRenderer  un único renderer que dibuja cada CourtView en su celda
  ui/       Capa de interfaz superpuesta (marcador)
  kiosk/    Modo kiosko para TV desatendida:
              cursorAutoHide  oculta el cursor tras la inactividad
              inputGuards     bloquea menú contextual y zoom por gesto
              wakeLock        impide que la pantalla entre en reposo
              fullscreen      entra a pantalla completa con el primer gesto
              index           startKioskMode() orquesta las piezas anteriores
  resilience/ Red de seguridad para el funcionamiento desatendido:
              globalErrorHandlers  captura window.onerror y unhandledrejection
              renderWatchdog       reanima el bucle si deja de pintar; recarga tras N fallos
              config               umbrales centralizados (timeouts, reintentos)
  main.ts   Punto de entrada que ensambla todo
```

## Modelo de dominio

Conceptos principales que representan un torneo de pádel:

- **Player** — un jugador (nombre).
- **Team** — pareja de jugadores.
- **Score** — marcador de pádel: punto del juego actual (0/15/30/40/Ventaja),
  juegos por set y sets ganados.
- **Match** — enfrentamiento entre dos equipos con su `Score`.
- **Court** — una pista, que contiene el `Match` que se juega en ella.

## Decisiones clave

### 1. El origen de los datos se esconde tras una interfaz (`DataSource`)
La app consume los datos a través de un "contrato" (`DataSource`), no
directamente del *mock*. Hoy existe un `MockDataSource`; en el futuro podrá
haber un `ApiDataSource` o `ControlPanelDataSource` **sin tocar el 3D ni la UI**.

*Por qué:* permite empezar sin backend y cambiar a datos reales con un coste
mínimo. Es la decisión que hace seguro "empezar con mock".

### 2. El marcador es un overlay HTML/CSS, no parte del 3D
El texto del marcador se renderiza como una capa HTML/CSS **superpuesta** al
canvas, no como texto dentro de la escena 3D.

*Por qué:* el texto HTML es nítido, accesible y mucho más fácil de maquetar para
que se lea bien en una TV, frente al texto renderizado en WebGL.

### 3. La pista 3D es un componente reutilizable (`PadelCourt` / `CourtView`)
La pista 3D se encapsula en `PadelCourt`, instanciable varias veces. Sobre ella,
`CourtView` representa **una pista autocontenida**: su propia escena, su cámara
de retransmisión, sus luces y su marcador, todo vinculado a un `DataSource`.

*Por qué:* el hito M3 necesita mostrar N pistas independientes; encapsular cada
pista como una vista autónoma evita compartir estado 3D entre pistas y deja al
contenedor (`main.ts`) solo la tarea de orquestar la rejilla.

### 4. Render multipista: un único renderer con un *viewport* por celda
Todas las pistas se dibujan con un **único `WebGLRenderer`** a pantalla completa.
La pantalla se reparte en una rejilla de celdas (`gridLayout`) y cada `CourtView`
se pinta en su celda con `setViewport`/`setScissor` (`MultiCourtRenderer`). Los
marcadores son una rejilla CSS superpuesta con la misma forma (columnas × filas).

*Por qué:* crear un renderer por pista chocaría con el límite de contextos WebGL
del navegador (~8–16) y penalizaría el rendimiento. Decisión detallada en el
[ADR 0001](decisions/0001-render-multipista-un-renderer-viewports.md)
(alternativa descartada: N renderers).

### 4b. Coste del bucle acotado (cap de FPS, pixel ratio y pausa en segundo plano)
El bucle de render limita su coste con topes sensatos, centralizados en
`scene/renderConfig.ts`:

- **Cap de FPS** (`FrameLimiter`): pinta a un objetivo (`TARGET_FPS`, 30 por
  defecto) en vez de a la tasa del display, saltándose los disparos sobrantes de
  `requestAnimationFrame`. El paso de tiempo que recibe la animación es el tiempo
  **real** transcurrido, así que el movimiento es independiente de los FPS: bajar
  el cap ahorra GPU sin ralentizar la escena.
- **Pixel ratio acotado**: `setPixelRatio(min(devicePixelRatio, MAX_PIXEL_RATIO))`
  evita renderizar de más en pantallas 4K/Retina, donde el coste crece con el
  cuadrado del ratio sin mejora visible a distancia de TV.
- **Pausa en segundo plano** (`visibilityPause`): al ocultarse la página se
  detiene el bucle y se reanuda al volver, reiniciando el reloj para que no dé
  saltos. No gasta CPU/GPU dibujando lo que nadie ve.

*Por qué:* la app está pensada para estar **días encendida** en una TV; sin topes,
una 4K o varias pistas gastarían GPU/energía sin beneficio visible. Cada pieza es
pura e inyectable, y se prueba aislada (`frameLimiter`, `visibilityPause`).

### 5. Avatares estilizados y posiciones representativas
Los jugadores son figuras estilizadas (*muñeco* low-poly) construidas **por
código** con primitivas y geometría procedural de Three.js (`PlayerAvatar`),
colocadas en sus zonas, sin tracking real. Nada de modelos externos
(glTF/GLB): así se conservan los tests estructurales y el pipeline sigue siendo
solo código.

Detalle del muñeco: torso con hombros y cuello, rostro con ojos/nariz/boca,
manos que insinúan dedos sobre el mango y extremidades organizadas en
**jerarquía por articulaciones** (hombro→codo→mano, cadera→rodilla→pie) pensando
en un rig futuro. La **pala** tiene silueta de gota con puente triangular y
grip oscuro; sus **agujeros se resuelven con una textura de transparencia**
(`alphaMap` procedural sobre la cara plana), **no** con geometría perforada,
para no disparar el recuento de triángulos con decenas de avatares en pantalla.

*Por qué:* es un alcance realista para un proyecto personal y rinde bien en TV.
El presupuesto se vigila con un test (≤ ~4.000 triángulos por avatar) para
sostener la tasa de FPS objetivo con la rejilla multipista (ver 4b).

### 6. Red de seguridad para el funcionamiento desatendido (`resilience/`)
La app está pensada para estar **días encendida** sin nadie delante, así que se
protege en varias capas apiladas, de la más suave a la más dura:

1. **Recuperación de contexto WebGL** (`contextRecovery`): reanuda el bucle si el
   navegador pierde y restaura el contexto GL.
2. **Captura global de errores** (`globalErrorHandlers`): registra excepciones no
   controladas y promesas rechazadas sin romper la app.
3. **Watchdog del bucle** (`renderWatchdog`): vigila un contador de fotogramas y,
   si deja de avanzar, **reinicia el bucle**; tras varios intentos infructuosos,
   **recarga la página** como último recurso.

Los umbrales (timeout del watchdog, nº de reintentos, ventana de tiempo) viven en
un único `resilience/config.ts`. El detalle y las alternativas descartadas están en
el [ADR 0002](decisions/0002-modo-tv-kiosko-rotacion-y-resiliencia.md).

*Por qué:* una excepción no capturada o un cuelgue silencioso dejarían la TV con
una imagen congelada sin que nadie lo note. Cada capa se prueba aislada
inyectando sus dependencias (reloj, documento, recarga), igual que el modo kiosko.

### 7. Modo kiosko para una TV desatendida (`kiosk/`)
La app se presenta como un *display* y no como una pestaña de navegador:
`startKioskMode()` (`kiosk/index.ts`) orquesta piezas independientes —cursor
autoocultado (`cursorAutoHide`), bloqueo de menú contextual y zoom por gesto
(`inputGuards`), *wake lock* para que la pantalla no entre en reposo (`wakeLock`) y
entrada a pantalla completa con el primer gesto (`fullscreen`)—. Las reglas
puramente visuales viven en `kiosk.css` bajo `.kiosk-active`.

*Por qué:* la app vive **días encendida y desatendida** en un club; sin esto se
verían el cursor, menús del navegador o el salvapantallas. Cada pieza es inyectable,
se prueba aislada y **degrada con elegancia** si su API no existe, así que activar
el kiosko es seguro en cualquier navegador (Chrome/Chromium es el de referencia).

### 8. Rotación automática de vistas (`kiosk/viewRotation.ts`)
Sin nadie que interactúe, el foco rota solo de forma cíclica: **vista global** (la
rejilla con todas las pistas) → **cada pista a pantalla completa** → global otra
vez, cambiando cada **30 s** (`ROTATION_INTERVAL_MS`). El módulo es solo una máquina
de estados con temporizador (sin Three.js ni DOM); `main.ts` pinta cada estado
**reutilizando la maquinaria del render multipista** —la vista individual es una
rejilla de 1 celda a pantalla completa—, sin duplicar layout. Se pausa con la
visibilidad de la página y las pistas ocultas siguen recibiendo datos.

*Por qué:* la vista global se lee de conjunto pero deja cada pista pequeña; alternar
con cada pista a pantalla completa da lo mejor de ambas sin intervención. Detalle y
alternativas en el [ADR 0002](decisions/0002-modo-tv-kiosko-rotacion-y-resiliencia.md).

### 9. La API propia tiene su propio contrato (DTO) y un adaptador al dominio
Cuando llegue el hito M6 (datos reales), la app leerá el estado de las pistas de
una **API propia**. Esa API define su **contrato** —la forma del JSON que
devuelve— en tipos `Api*` (`data/apiContract.ts`), separados de los tipos del
dominio. Un **adaptador puro** (`data/mapApiCourt.ts`, `mapApiCourt(dto): Court`)
traduce el DTO al dominio; el `ApiDataSource` (issue aparte) solo hará la llamada
de red y pasará la respuesta por este adaptador.

Endpoints previstos y campos:

```
GET /api/courts       -> ApiCourt[]   Estado de todas las pistas.
GET /api/courts/:id   -> ApiCourt     Estado de una pista concreta.

ApiCourt { id: number, name: string, match: ApiMatch | null }
ApiMatch { teams: [ApiTeam, ApiTeam], score: ApiScore }
ApiScore { currentPoint: [ApiPoint, ApiPoint], games: [number, number][], sets: [number, number] }
ApiPoint = 0 | 15 | 30 | 40 | "AD"   // "AD" (ventaja) → 'Ventaja' en el dominio
```

*Por qué:* separar el formato de cable del dominio permite que el backend
evolucione su JSON sin arrastrar cambios por el 3D ni la UI —solo se toca el
adaptador—, y hace el mapeo **puro y testeable** con ejemplos de payload (incluida
la pista libre, `match: null`), antes incluso de que exista la llamada de red.

### 10. La fuente de datos se elige por configuración (mock ⇄ API) con fallback a mock
El origen de los datos —`MockDataSource` o `ApiDataSource`— se decide **por
configuración**, no en el código. Una factoría (`data/createDataSources.ts`)
construye una fuente por pista según una `DataSourceConfig` que un lector puro
(`data/dataSourceConfig.ts`) resuelve de:

- **`VITE_DATA_SOURCE`** (`mock` | `api`) — fijada en build/despliegue.
- **`?source=`** en la URL — **con prioridad** sobre la env var, para alternar en
  una demo sin reconstruir.

El `apiBaseUrl` sale de `VITE_API_BASE_URL` (por defecto `/api`) y en modo `api`
cada pista sondea `GET {apiBaseUrl}/courts/:id`. Por defecto —sin config o ante un
valor desconocido— se usa **mock** (comportamiento actual). Las fuentes de API se
**siembran con los datos mock** de su pista: ese `Court` es el estado inicial y de
respaldo hasta la primera respuesta, así que si la API no está disponible la
pantalla muestra datos con sentido y el `ApiDataSource` sigue reintentando el
sondeo (encaminando los errores a `onError`) hasta que la API vuelve.

Ante un fallo, el sondeo **no se detiene**: en vez de un intervalo fijo, el bucle
se auto-agenda con **reintento por *backoff* exponencial** (`resilience/backoff.ts`,
tope en `resilience/config.ts`), rápido al principio para un microcorte y
relajándose si la API sigue caída. Además el `ApiDataSource` expone el **estado de
conexión** (`connecting`/`online`/`offline`, contrato opcional
`StatusReportingDataSource`); tras varios fallos seguidos pasa a `offline` y el
marcador pinta un aviso **«sin datos · reconectando»** legible en la TV
(`ui/Scoreboard.ts`), que desaparece solo al volver a `online`. Las fuentes mock no
reportan estado y se muestran siempre disponibles.

*Por qué:* materializa la decisión 1 (origen tras una interfaz) como un
interruptor de configuración: se despliega con mock y se pasa a datos reales sin
tocar el 3D ni la UI, con una red de seguridad que evita la pantalla en blanco si
la red o la configuración fallan. El lector y la factoría son puros e inyectables,
probados aislados (`dataSourceConfig.test.ts`, `createDataSources.test.ts`).

---

> 💡 Las decisiones importantes se documentan como **ADRs**
> (*Architecture Decision Records*) en [`docs/decisions/`](decisions/), un
> archivo por decisión. Ver el [ADR 0001 — render
> multipista](decisions/0001-render-multipista-un-renderer-viewports.md) y el
> [ADR 0002 — modo TV/kiosko: rotación y
> resiliencia](decisions/0002-modo-tv-kiosko-rotacion-y-resiliencia.md).
