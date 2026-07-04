# ADR 0003 — Fuente de datos real: una API propia consumida por *polling*

- **Estado:** Aceptada
- **Fecha:** 2026-07-04
- **Hito:** M6 — Datos reales
- **Contexto en el código:** `src/data/` (`DataSource.ts`, `apiContract.ts`,
  `mapApiCourt.ts`, `ApiDataSource.ts`, `dataSourceConfig.ts`,
  `createDataSources.ts`), `src/resilience/` (`backoff.ts`, `config.ts`),
  `src/ui/Scoreboard.ts`

## Contexto

Hasta M5 la app se alimentaba de un `MockDataSource` que simula un partido. El
hito **M6** sustituye esa simulación por una **fuente de datos real** que refleje
lo que ocurre de verdad en las pistas de un club, sin reescribir el 3D ni la UI.

La decisión 1 de la [arquitectura](../architecture.md) ya dejó el terreno
preparado: el origen de los datos vive tras la interfaz `DataSource`, de modo que
hoy hay un `MockDataSource` y mañana puede haber un `ApiDataSource` **sin tocar la
escena ni el marcador**. M6 tiene que responder a las preguntas que quedaban
abiertas:

1. **¿De dónde salen los datos reales?** ¿Una API propia, un panel de control,
   un servicio de terceros…?
2. **¿Cómo llegan al navegador?** ¿La app *pregunta* cada cierto tiempo
   (*polling*) o el servidor *empuja* los cambios (WebSocket/SSE)?
3. **¿Cómo se protege la pantalla de la TV** cuando la red o el backend fallan,
   dado que el panel vive **días encendido y desatendido** (ver [ADR 0002](0002-modo-tv-kiosko-rotacion-y-resiliencia.md))?

Este ADR registra esas decisiones. El *cómo* técnico (contrato/DTO, adaptador,
factoría por configuración, *backoff* y estado de conexión) está desarrollado en
las decisiones **1, 9 y 10** de la [arquitectura](../architecture.md); aquí se
recoge el **porqué** de la fuente elegida y de las alternativas descartadas.

## Decisión

La fuente de datos real es una **API propia** de solo lectura que expone el
estado de las pistas, y la app la consume por **_polling_**:

- **API propia como fuente principal.** Un backend nuestro publica el estado de
  cada pista bajo `GET /api/courts` y `GET /api/courts/:id`. Es *nuestro*
  contrato: lo controlamos y lo hacemos a la medida de lo que la app necesita
  pintar (ver endpoints y campos en `apiContract.ts`).
- **Contrato (DTO) separado del dominio + adaptador puro.** La API define su JSON
  en tipos `Api*` (`data/apiContract.ts`), y un adaptador puro
  (`mapApiCourt(dto): Court`, `data/mapApiCourt.ts`) lo traduce al dominio. El
  backend puede evolucionar su formato de cable sin arrastrar cambios por el 3D
  ni la UI: solo se toca el adaptador (decisión 9 de la arquitectura).
- **_Polling_ como mecanismo de transporte.** Cada pista sondea su endpoint cada
  `intervalMs` (5 s por defecto). El `ApiDataSource` (`data/ApiDataSource.ts`)
  implementa la interfaz `DataSource`: arranca el bucle con el primer suscriptor
  y lo para con el último.
- **Elección por configuración, con _fallback_ a mock.** Una factoría
  (`createDataSources`) decide mock ⇄ API según `VITE_DATA_SOURCE` o `?source=`
  (decisión 10). Las fuentes de API se **siembran con los datos mock** de su
  pista: ese `Court` es el estado inicial y de respaldo hasta la primera
  respuesta, así que la pantalla **nunca queda en blanco**.
- **Resiliencia ante fallos de red.** Un fallo **no** detiene el sondeo: en vez
  de un intervalo fijo, el bucle se auto-agenda con **_backoff_ exponencial**
  (`resilience/backoff.ts`), rápido para un microcorte y relajándose si la API
  sigue caída. El `ApiDataSource` expone además el **estado de conexión**
  (`connecting`/`online`/`offline`, contrato opcional
  `StatusReportingDataSource`); tras varios fallos seguidos pasa a `offline` y el
  marcador pinta un aviso **«sin datos · reconectando»** (`ui/Scoreboard.ts`) que
  desaparece solo al volver a `online`.

## Alternativas descartadas

**WebSocket / SSE (el servidor empuja los cambios) en lugar de _polling_.** Un
canal *push* daría latencia menor y evitaría peticiones repetidas, pero para este
panel el *polling* gana por sencillez y robustez:

- El dato que se muestra (marcador de pádel) cambia en la escala de **segundos**,
  no de milisegundos: un sondeo cada pocos segundos es más que suficiente.
- Un socket persistente hay que **mantenerlo vivo** días enteros (reconexiones,
  *heartbeats*, estados del socket), justo el tipo de complejidad de larga
  duración que este proyecto quiere evitar en una TV desatendida.
- El *polling* con `fetch` encaja de forma natural con la **red de seguridad**
  ya existente: reintento con *backoff* y estado de conexión son triviales sobre
  peticiones discretas, mientras que sobre un socket habría que reimplementarlos.
- No exige nada especial del backend (un endpoint REST de solo lectura basta),
  lo que abarata montar la API propia.

Si en el futuro la latencia importara, el transporte se puede cambiar **dentro
del `DataSource`** sin tocar el resto de la app.

**Un «panel de control» como fuente directa de la app.** Se barajó que la app
leyera de un panel de control (una herramienta de operador que edita los
marcadores a mano). Se descarta como *fuente que consume la app*: el panel de
control es, si acaso, **otro productor que alimenta a la API propia**, no algo de
lo que la app tire directamente. La app habla siempre con **una** fuente detrás
de la interfaz `DataSource`; multiplicar orígenes en el cliente rompería esa
abstracción.

**Consumir un servicio de terceros como fuente principal (p. ej. Playtomic).**
Depender de una API externa como *fuente principal* nos ataría a su formato, su
disponibilidad y sus límites de uso. Se prefiere una **API propia** que
controlamos; un tercero como Playtomic queda como **enriquecimiento** futuro
(ver M7 en el [roadmap](../ROADMAP.md)), leyendo jugadores de las reservas, pero
**sin** ser la fuente del marcador.

**Llamar a `fetch` directamente desde la escena/UI, sin DTO ni adaptador.**
Acoplaría el formato de cable al 3D y a la UI: cualquier cambio del JSON del
backend obligaría a tocar componentes de render. Separar el DTO del dominio y
mapear con un adaptador puro mantiene ese cambio **en un solo punto** y hace el
mapeo testeable con *payloads* de ejemplo (incluida la pista libre, `match: null`).

**Sin _fallback_ ni estado de conexión (fallo de red ⇒ pantalla vacía o error).**
Para un panel desatendido es inaceptable: un microcorte dejaría la TV en blanco
sin que nadie lo arregle. Por eso el `ApiDataSource` se siembra con datos mock de
respaldo, reintenta con *backoff* y señala «sin datos» de forma legible en vez de
romperse.

## Consecuencias

**A favor:**

- La fuente real entra **sin tocar el 3D ni la UI**: materializa la decisión 1
  (origen tras una interfaz) como un interruptor de configuración.
- El *polling* es simple, robusto y encaja con la red de seguridad
  (*backoff* + estado de conexión); la TV nunca queda en blanco.
- El DTO separado del dominio deja que el backend evolucione su JSON tocando solo
  el adaptador, que es **puro y testeable**.
- El transporte (polling) está encapsulado en el `DataSource`: cambiarlo a *push*
  en el futuro no arrastra al resto de la app.

**En contra / a tener en cuenta:**

- El *polling* introduce una **latencia** de hasta `intervalMs` entre el cambio
  real y lo que se ve; para un marcador es asumible, pero conviene recordarlo.
- Hay N sondeos en paralelo (uno por pista); si el número de pistas creciera
  mucho, valdría la pena un endpoint agregado (`GET /api/courts`) y una fuente que
  lo reparta, en vez de una petición por pista.
- Este ADR fija la fuente y el transporte, pero **no** implementa el backend: la
  API propia es un servicio aparte que debe cumplir el contrato de `apiContract.ts`.
