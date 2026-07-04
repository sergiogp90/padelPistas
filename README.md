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

La app puede leer los datos de un **mock local** (por defecto) o de una **API
real**, y se elige **por configuración**, sin tocar el código. Ante un valor
desconocido o un fallo de red, cae con elegancia al mock.

**Por variable de entorno** (recomendado para despliegues). Crea un `.env.local`:

```bash
# Fuente: "mock" (por defecto) o "api"
VITE_DATA_SOURCE=api
# Base de la API propia (opcional; por defecto "/api")
VITE_API_BASE_URL=https://mi-club.example/api
```

En modo `api` la app consulta `GET {VITE_API_BASE_URL}/courts/:id` por pista y
refresca el marcador por *polling* (ver [arquitectura](docs/architecture.md)).

**Por parámetro de URL** (rápido para una demo, sin reconstruir el build). Tiene
prioridad sobre la variable de entorno:

```
http://localhost:5173/?source=api
http://localhost:5173/?source=mock
```

> Si no se configura nada, o el valor no se reconoce, se usa el **mock**
> (comportamiento actual). Si la API no está disponible, cada pista conserva su
> dato de respaldo (mock) y el sondeo se **reintenta con *backoff* exponencial**
> hasta que la API vuelve; tras varios fallos seguidos el marcador muestra un
> aviso **«sin datos · reconectando»** legible en la TV, que se retira solo al
> recuperarse la conexión (ver [arquitectura](docs/architecture.md)).

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
