/// <reference types="vite/client" />

// Tipado de las variables de entorno propias (prefijo `VITE_`, ver Vite env).
// Así `import.meta.env.VITE_DATA_SOURCE` deja de ser `any` y el config reader
// (ver `data/dataSourceConfig.ts`) las consume con tipos.
interface ImportMetaEnv {
  /** Fuente de datos por defecto: `mock` (predeterminado) o `api`. */
  readonly VITE_DATA_SOURCE?: string;
  /** Base de la API propia (por defecto `/api`), p. ej. `https://mi-club/api`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
