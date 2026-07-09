// Resolución de la **fuente de datos por configuración** (mock ⇄ API real).
//
// Lee de dónde salen los datos sin tocar la lógica de la app: de la variable de
// entorno `VITE_DATA_SOURCE` (fijada en build/despliegue) o del parámetro de URL
// `?source=` (útil para alternar en una demo sin reconstruir). El resultado es
// una `DataSourceConfig` que consume la factoría `createDataSources`.
//
// Diseño puro e inyectable (como el resto de `data/`): las fuentes de entrada
// —`env`, `search`, `warn`— se pasan por parámetro, así los tests no dependen del
// entorno real. Por defecto se leen de `import.meta.env`, `location.search` y
// `console.warn`.
//
// Fuente por defecto `api`: sin configuración —o ante un valor desconocido— se
// usa la **API real**, no el mock. El mock solo aparece si se pide de forma
// explícita (`VITE_DATA_SOURCE=mock` o `?source=mock`), como red de seguridad
// para desarrollo y demos (ver issue #130: en producción nunca debe verse mock
// salvo configuración explícita).

/** Origen de los datos: simulación local (`mock`) o API propia (`api`). */
export type DataSourceKind = 'mock' | 'api';

/** Configuración resuelta que decide qué `DataSource` construir. */
export interface DataSourceConfig {
  /** Fuente elegida; `api` por defecto. */
  kind: DataSourceKind;
  /** Base de la API propia (sin barra final), p. ej. `/api`. */
  apiBaseUrl: string;
}

/** Entradas inyectables para resolver la configuración (todas opcionales). */
export interface ResolveDataSourceConfigInput {
  /** Variables de entorno (por defecto `import.meta.env`). */
  env?: ImportMetaEnv;
  /** Query string de la URL, p. ej. `?source=api` (por defecto `location.search`). */
  search?: string;
  /** Aviso ante configuración inválida (por defecto `console.warn`). */
  warn?: (message: string) => void;
}

/** Base de la API por defecto cuando no se configura `VITE_API_BASE_URL`. */
export const DEFAULT_API_BASE_URL = '/api';

/**
 * Resuelve la fuente de datos a partir de la configuración disponible.
 *
 * Precedencia: `?source=` (URL) **por encima de** `VITE_DATA_SOURCE` (entorno),
 * porque el parámetro de URL sirve para alternar puntualmente en una demo sin
 * reconstruir el build. Si ninguno está presente o el valor no se reconoce, se
 * usa `api` (la API real es el modo por defecto; el mock solo con petición
 * explícita).
 */
export function resolveDataSourceConfig(
  input: ResolveDataSourceConfigInput = {},
): DataSourceConfig {
  const env = input.env ?? import.meta.env;
  const search = input.search ?? getLocationSearch();
  const warn = input.warn ?? ((message) => console.warn(message));

  // `?source=` gana a la env var (alternar en demo sin rebuild).
  const fromQuery = new URLSearchParams(search).get('source');
  const raw = fromQuery ?? env.VITE_DATA_SOURCE;

  return {
    kind: normalizeKind(raw, warn),
    apiBaseUrl: normalizeBaseUrl(env.VITE_API_BASE_URL),
  };
}

/** Valida el valor crudo y cae a `api` (avisando) si no se reconoce. */
function normalizeKind(
  raw: string | undefined | null,
  warn: (message: string) => void,
): DataSourceKind {
  if (raw == null || raw.trim() === '') return 'api';

  const value = raw.trim().toLowerCase();
  if (value === 'mock' || value === 'api') return value;

  warn(
    `[dataSource] Fuente de datos desconocida "${raw}"; se usa "api" por defecto. ` +
      `Valores válidos: "mock" o "api".`,
  );
  return 'api';
}

/** Normaliza la base de la API: recorta espacios y la barra final sobrante. */
function normalizeBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_API_BASE_URL;
  return value.replace(/\/+$/, '');
}

/** Lee `location.search` con tolerancia a entornos sin `window` (SSR/tests). */
function getLocationSearch(): string {
  return typeof location !== 'undefined' ? location.search : '';
}
