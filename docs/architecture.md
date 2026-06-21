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
  scene/    Construcción de la escena 3D (pista, cámara, luces)
  ui/       Capa de interfaz superpuesta (marcador)
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

### 3. La pista 3D es un componente reutilizable
La construcción de una pista se encapsula en una función/clase que se puede
instanciar varias veces.

*Por qué:* el hito M3 necesita mostrar N pistas; encapsular desde el principio
evita reescribir el render.

### 4. Avatares estilizados y posiciones representativas
Los jugadores serán figuras simples (low-poly / cápsulas / sprites) colocadas en
sus zonas, sin tracking real.

*Por qué:* es un alcance realista para un proyecto personal y rinde bien en TV.

---

> 💡 Las decisiones importantes futuras pueden documentarse como **ADRs**
> (*Architecture Decision Records*) en `docs/decisions/`, un archivo por decisión.
