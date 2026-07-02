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
mantener 60 FPS con la rejilla multipista.

---

> 💡 Las decisiones importantes se documentan como **ADRs**
> (*Architecture Decision Records*) en [`docs/decisions/`](decisions/), un
> archivo por decisión. Ver el [ADR 0001 — render
> multipista](decisions/0001-render-multipista-un-renderer-viewports.md).
