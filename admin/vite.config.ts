import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// El admin se sirve bajo /admin (single-origin desde el host .NET; ver #136), así
// que Vite usa esa base tanto en dev como en el build. La API se consume en /api,
// que en dev se redirige (proxy) al backend .NET para evitar CORS.
// La configuración de tests vive en vitest.config.ts (para no mezclar los tipos de
// Vite y de la Vite que empaqueta Vitest).
export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5005', changeOrigin: true },
    },
  },
})
