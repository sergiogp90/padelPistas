import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// Config de Vitest, separada de vite.config.ts a propósito: Vitest empaqueta su
// propia copia de Vite y mezclar ambos juegos de tipos en el mismo fichero rompe
// el typecheck. Este fichero no se incluye en tsc; Vitest lo transpila en runtime.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
