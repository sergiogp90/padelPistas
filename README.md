# padelPistas

Panel de visualización 3D para clubes de pádel. Muestra en una televisión, en
tiempo real durante un torneo, varias pistas con sus jugadores y marcadores.

Construido con [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/) y
TypeScript.

## Estructura del repositorio

Este repositorio es un **monorepo**:

- `front/` — la aplicación web (Three.js + Vite + TypeScript).
- `back/` — la API propia en .NET *(en construcción; ver
  [ADR 0004](docs/decisions/0004-backend-api-propia-minimal-api-aspire.md))*.
- `docs/` — documentación transversal (arquitectura, roadmap, ADRs).

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- npm (incluido con Node.js)

## Puesta en marcha

El código del front vive en `front/`:

```bash
cd front

# Instalar dependencias
npm install

# Arrancar el servidor de desarrollo (http://localhost:5173)
npm run dev
```

## Scripts disponibles

Se ejecutan desde `front/`:

| Comando           | Descripción                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Servidor de desarrollo con recarga en caliente   |
| `npm run build`   | Compila TypeScript y genera el build en `dist/`  |
| `npm run preview` | Sirve localmente el build de producción          |

## Fuente de datos (mock ⇄ API)

La app lee los datos de una **API real** (por defecto) o de un **mock local**, y
se elige **por configuración**, sin tocar el código. El mock solo aparece si se
pide de forma explícita; en modo `api` **no hay datos mock de respaldo**.

**Por variable de entorno** (recomendado para despliegues). Crea un `.env.local`:

```bash
# Fuente: "api" (por defecto) o "mock"
VITE_DATA_SOURCE=api
# Base de la API propia (opcional; por defecto "/api")
VITE_API_BASE_URL=https://mi-club.example/api
```

En modo `api` la app deriva **cuántas pistas hay y sus ids** del listado
`GET {VITE_API_BASE_URL}/courts` (fuente única de verdad): crea una vista por
pista devuelta y consulta `GET {VITE_API_BASE_URL}/courts/:id` para refrescar su
marcador por *polling*. Así no se piden ids que la API no sirve y la rejilla se
adapta al número real de pistas (ver [arquitectura](docs/architecture.md)).

**Por parámetro de URL** (rápido para una demo, sin reconstruir el build). Tiene
prioridad sobre la variable de entorno:

```
http://localhost:5173/?source=api
http://localhost:5173/?source=mock
```

> Si no se configura nada, o el valor no se reconoce, se usa la **API** (la
> fuente por defecto); el **mock** solo se activa con `VITE_DATA_SOURCE=mock` o
> `?source=mock`. En modo `api` no hay datos mock de respaldo: si la API está
> inactiva al arrancar, el listado `GET /courts` se **reintenta con *backoff*
> exponencial** hasta que responda y el snackbar muestra **«Sin conexión con la
> API; reintentando conectar…»**; al ponerse operativa se cargan las pistas
> reales. Una vez cargadas, si una pista pierde la conexión el sondeo se reintenta
> igual (con backoff) y su marcador muestra **«sin datos · reconectando»** hasta
> recuperarse (ver [arquitectura](docs/architecture.md)).

## Documentación

- 📍 [Roadmap y objetivos](docs/ROADMAP.md) — la visión y los hitos del proyecto
- 🏗️ [Arquitectura](docs/architecture.md) — decisiones técnicas y estructura

> El **estado** del trabajo (qué está hecho o en curso) se sigue en los
> [Milestones](https://github.com/sergiogp90/padelPistas/milestones) e
> [Issues](https://github.com/sergiogp90/padelPistas/issues) de GitHub, no en
> estos documentos.

## Stack

- **Three.js** — motor de gráficos 3D sobre WebGL
- **Vite** — bundler y servidor de desarrollo
- **TypeScript** — tipado estático

## Flujo de trabajo

El desarrollo sigue un flujo basado en ramas y Pull Requests:

1. Cada cambio se hace en una rama (`feat/...`, `fix/...`, `chore/...`, `docs/...`).
2. Los commits siguen la convención [Conventional Commits](https://www.conventionalcommits.org/).
3. Los cambios se integran a `main` mediante Pull Request.
