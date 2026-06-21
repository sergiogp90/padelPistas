# padelPistas

Panel de visualización 3D para clubes de pádel. Muestra en una televisión, en
tiempo real durante un torneo, varias pistas con sus jugadores y marcadores.

Construido con [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/) y
TypeScript.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior
- npm (incluido con Node.js)

## Puesta en marcha

```bash
# Instalar dependencias
npm install

# Arrancar el servidor de desarrollo (http://localhost:5173)
npm run dev
```

## Scripts disponibles

| Comando           | Descripción                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Servidor de desarrollo con recarga en caliente   |
| `npm run build`   | Compila TypeScript y genera el build en `dist/`  |
| `npm run preview` | Sirve localmente el build de producción          |

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
