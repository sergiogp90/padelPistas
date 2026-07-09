import { defineConfig } from 'vite'

// Configuración del dev server de Vite.
//
// Proxy de `/api` → backend .NET (`http://localhost:5005`): en desarrollo el
// front se sirve en `localhost:5173` y la API en `localhost:5005`, orígenes
// distintos. En vez de habilitar CORS en el backend, el dev server reenvía las
// peticiones a `/api/*` al backend, de modo que el navegador solo ve un origen
// (el de Vite) y no hay bloqueo CORS.
//
// Así la base de la API por defecto (`/api`, relativa; ver `dataSourceConfig.ts`)
// funciona sin más: `GET /api/courts/1` desde el navegador acaba en
// `http://localhost:5005/api/courts/1`. Cambia `target` si tu backend usa otro
// puerto (ver `back/PadelPistas.Api/Properties/launchSettings.json`).
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
      },
    },
  },
})
