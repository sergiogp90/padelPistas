# Roadmap

> Este documento describe la **visión** y los **hitos** del proyecto (el *qué* y
> el *por qué*). El **estado** de cada tarea vive en los
> [Milestones](https://github.com/sergiogp90/padelPistas/milestones) e
> [Issues](https://github.com/sergiogp90/padelPistas/issues) de GitHub.

## Visión

Panel de visualización para televisión que muestra, en tiempo real durante un
torneo de pádel, varias pistas con sus jugadores y marcadores. Pensado para
funcionar **desatendido** en la pantalla de un club.

## Objetivos

### Funcionales
- Mostrar **N pistas** simultáneamente en una pantalla.
- Cada pista: **vista 3D**, **jugadores** y **marcador en tiempo real**.

### No funcionales
- **Legibilidad a distancia**: tipografía grande y alto contraste.
- **Funcionamiento desatendido**: modo kiosko y auto-recuperación ante fallos.
- **Rendimiento fluido** con varias pistas a la vez.
- **Adaptado** a la resolución de la televisión (Full HD de referencia).

## Hitos

El desarrollo es **iterativo**: cada hito entrega algo funcionando de punta a
punta (una "rebanada vertical"), priorizando el valor.

| Hito | Entrega | Estado |
| ---- | ------- | ------ |
| **M1 — MVP: una pista** | Una pista 3D + marcador legible para TV, con datos *mock* fijos. La base mínima que ya se ve en pantalla. | ✅ Finalizado |
| **M2 — Tiempo real** | Interfaz `DataSource` + fuente *mock* que simula un partido y actualiza el marcador automáticamente. | ✅ Finalizado |
| **M3 — Multipista** | Sistema de rejilla para mostrar N pistas a la vez, cada una con su partido en vivo. Un único renderer con un *viewport* por celda. | ✅ Finalizado |
| **M4 — Jugadores** | Avatares estilizados (4 por pista, color por equipo) en posiciones representativas. | ✅ Finalizado |
| **M5 — Modo TV / pulido** | Modo kiosko, rotación automática de vistas, auto-recuperación y optimización de rendimiento. Decisiones en el [ADR 0002](decisions/0002-modo-tv-kiosko-rotacion-y-resiliencia.md). | ✅ Finalizado |
| **M6 — Datos reales** *(futuro)* | Sustituir el *mock* por una fuente real (API o panel de control) implementando la interfaz `DataSource`. Además, **inicializar los avatares a partir de los datos** de cada jugador (p. ej. elegir el diseño de avatar según el género), en lugar de colocarlos con valores fijos. | 💡 Idea |

## Decisiones de alcance (versión inicial)

- **Datos**: se empieza con datos *mock*, ocultos tras una interfaz para poder
  cambiar a datos reales sin reescribir la app (ver [arquitectura](architecture.md)).
- **Jugadores**: avatares **estilizados** (no modelos realistas).
- **Posiciones**: **representativas** (sin tracking real de jugadores).
