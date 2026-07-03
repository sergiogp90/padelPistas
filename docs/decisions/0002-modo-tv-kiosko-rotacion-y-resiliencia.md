# ADR 0002 — Modo TV/kiosko: rotación de vistas y resiliencia desatendida

- **Estado:** Aceptada
- **Fecha:** 2026-07-03
- **Hito:** M5 — Modo TV / pulido
- **Contexto en el código:** `src/kiosk/` (`index.ts`, `viewRotation.ts`,
  `cursorAutoHide.ts`, `inputGuards.ts`, `wakeLock.ts`, `fullscreen.ts`),
  `src/resilience/` (`renderWatchdog.ts`, `globalErrorHandlers.ts`, `config.ts`),
  `src/scene/contextRecovery.ts`, `src/main.ts`

## Contexto

El objetivo del proyecto es un panel que vive **días encendido y desatendido** en
la TV de un club: nadie está delante para tocar el ratón, salir de un salvapantallas,
cerrar un diálogo del navegador ni recargar la página si algo se cuelga. M5 recoge
las decisiones que hacen que esa operación desatendida sea **estable y agradable de
ver**, y que se agrupan en dos frentes:

1. **Presentación de kiosko.** Cómo se muestra la app para que parezca un
   *display* y no una pestaña de navegador: pantalla completa, sin cursor, sin
   menús contextuales ni gestos de zoom, sin que la pantalla entre en reposo.
2. **Qué se enseña a lo largo del tiempo.** Con varias pistas, la vista global en
   rejilla se lee bien de conjunto pero deja cada pista pequeña. Hace falta una
   política de **qué mira el espectador** sin que nadie interactúe.
3. **Resiliencia.** Qué pasa cuando algo falla sin nadie delante: contexto WebGL
   perdido, una excepción no capturada, o el bucle de render que deja de pintar.

Este ADR registra las decisiones de esos frentes. La decisión de *cómo* se dibujan
N pistas en un solo canvas ya está en el [ADR 0001](0001-render-multipista-un-renderer-viewports.md);
aquí se construye **encima** de ese modelo (un único renderer, un viewport por celda).

## Decisión

### Rotación automática de vistas (`kiosk/viewRotation.ts`)

Se rota el foco de forma cíclica: **vista global** (la rejilla con todas las pistas)
→ **cada pista a pantalla completa**, una tras otra → global otra vez, avanzando
**solo cada 30 s** (`ROTATION_INTERVAL_MS`).

- El módulo es **solo una máquina de estados con temporizador**: no toca Three.js,
  ni el DOM de layout, ni los marcadores. Notifica cada cambio por un `onChange`, y
  `main.ts` decide cómo pintar cada estado reutilizando la maquinaria del ADR 0001
  (la vista individual no es más que una rejilla de **1 celda** = viewport a
  pantalla completa). No se duplica lógica de layout.
- **Se pausa con la visibilidad de la página**: mientras la pestaña está oculta no
  avanza, y al volver **rearma el intervalo entero**, para que una vista no rote
  nada más reaparecer la página.
- Las pistas ocultas **siguen recibiendo datos** (su marcador está al día al volver
  a la global); solo se congela su animación 3D.

### Presentación de kiosko (`kiosk/`)

`startKioskMode()` orquesta piezas independientes, cada una **inyectable y probada
aislada**, y cada una **degrada con elegancia** si su API no está disponible (así
activar kiosko es seguro en cualquier navegador; Chrome/Chromium es el de
referencia para TV):

- `cursorAutoHide` — oculta el cursor tras la inactividad.
- `inputGuards` — bloquea menú contextual y zoom por gesto.
- `wakeLock` — impide que la pantalla entre en reposo.
- `fullscreen` — entra a pantalla completa con el primer gesto (los navegadores
  exigen un gesto de usuario para pantalla completa: no se puede forzar al cargar).

Las reglas puramente visuales (sin selección, sin scroll/zoom táctil, cursor
oculto) viven en `kiosk.css` bajo `.kiosk-active`.

### Resiliencia en capas (`resilience/` + `scene/contextRecovery.ts`)

Red de seguridad **apilada de lo más suave a lo más duro**, para que un fallo se
resuelva con el mínimo impacto visible y solo se llegue a la recarga como último
recurso:

1. **Recuperación de contexto WebGL** (`contextRecovery`): escucha
   `webglcontextlost`/`webglcontextrestored` en el canvas. Detalle **clave**:
   `preventDefault()` en `webglcontextlost` — sin él el navegador da el contexto
   por perdido de forma definitiva y **no** emite la restauración. Al restaurarse
   se reanuda el bucle; si reconstruir no es viable, se recarga.
2. **Captura global de errores** (`globalErrorHandlers`): escucha `error` y
   `unhandledrejection` y los **registra sin romper la app** (no relanza, no hace
   `preventDefault`, nunca deja que un fallo del propio manejador tumbe la app).
3. **Watchdog del bucle** (`renderWatchdog`): vigila un **contador de fotogramas**
   del renderer. Si no avanza durante `STALL_TIMEOUT_MS` (5 s), **reinicia el
   bucle**; tras `MAX_RESTARTS` (3) reinicios dentro de `RESTART_WINDOW_MS` (60 s),
   **recarga la página** como recuperación dura.

El watchdog y la rotación **se pausan con la visibilidad de la página**, porque
`requestAnimationFrame` se congela cuando la pestaña está oculta: sin esa pausa, esa
congelación legítima se confundiría con un atasco. Todos los umbrales viven en un
único `resilience/config.ts`.

Ante un incidente, `main.ts` muestra un **overlay discreto** (una banda en una
esquina) que se retira solo tras `ERROR_OVERLAY_TIMEOUT_MS`, en vez de dejar texto
fijo sobre la imagen de la TV.

## Alternativas descartadas

**Rotación en el DOM/CSS (mostrar/ocultar canvases o capas).** Encajaría mal con el
modelo del ADR 0001 (un único canvas): implicaría o volver a varios canvases —con el
problema del límite de contextos WebGL— o duplicar la aritmética de layout. Rotar
como una **máquina de estados que reusa `gridLayout`** mantiene un solo renderer y un
solo camino de maquetado.

**Rotación en el propio renderer/escena.** Meter el temporizador y el ciclo dentro
de `MultiCourtRenderer` mezclaría la política de *qué se muestra* (producto) con el
*cómo se dibuja* (técnica) y haría el ciclo imposible de probar sin Three.js.
Separarlo en un módulo puro lo hace testeable como `gridLayout`.

**Solo recargar la página ante cualquier fallo.** Una recarga es visible (parpadeo,
recarga de assets) y pierde el estado; usarla como **primera** respuesta castiga al
espectador ante microcortes recuperables. Por eso la recarga es el **último** peldaño,
tras intentar reanudar contexto y reiniciar el bucle.

**No `preventDefault()` en `webglcontextlost`.** Sin él la recuperación automática es
imposible (el navegador no vuelve a emitir la restauración): el panel quedaría
congelado hasta que alguien recargue a mano, justo lo que hay que evitar.

**Kiosko como un módulo monolítico.** Un solo bloque que lo hiciera todo sería
difícil de probar y de degradar por partes. Se prefirió **una pieza por
responsabilidad**, inyectable y con degradación elegante individual.

**Panel de rendimiento (FPS/ms) siempre visible o siempre cargado.** Mediría el coste
en producción y ensuciaría la imagen de la TV. Se integra `stats.js` **solo** tras el
flag `?stats` en la URL, y ni siquiera se carga sin él (ver `scene/perfMonitor.ts`),
de modo que el modo TV normal no paga ese coste.

## Consecuencias

**A favor:**

- La lógica de *qué se muestra en el tiempo* (`viewRotation`) es una máquina de
  estados pura, testeable y ajustable en un punto (`ROTATION_INTERVAL_MS`), sin
  tocar el render.
- La resiliencia está **en capas** con umbrales centralizados (`resilience/config.ts`):
  afinar la tolerancia de la TV no exige tocar la lógica.
- Cada pieza de kiosko degrada sola: activar el modo es seguro en cualquier
  navegador.
- Rotación y watchdog respetan la visibilidad de la página: ni gastan recursos
  ocultos ni confunden esa pausa con un fallo.

**En contra / a tener en cuenta:**

- La rotación introduce estado temporal en la presentación: al depurar conviene
  recordar que la pista visible cambia sola cada 30 s.
- El watchdog depende de que el renderer exponga un contador de fotogramas fiable
  (`app.frames`); si esa señal se rompiera, el watchdog podría actuar de más o de
  menos.
- Las capas de resiliencia deben probarse con dobles (reloj, documento, recarga
  inyectados), ya que su comportamiento depende del tiempo y de eventos del
  navegador.
