import type { DataSource } from './DataSource';
import { ApiDataSource } from './ApiDataSource';
import { createMockCourts } from './createMockCourts';
import { createMockDataSources } from './createMockDataSources';
import { resolveDataSourceConfig, type DataSourceConfig } from './dataSourceConfig';

// Factoría que decide la fuente de datos **por configuración** (mock ⇄ API real)
// sin que el resto de la app —el 3D, la UI, `main.ts`— sepa de dónde salen los
// datos: todas las fuentes cumplen el mismo contrato `DataSource`.
//
// - Modo `mock` (por defecto): N `MockDataSource` diferenciadas, igual que hasta
//   ahora (ver `createMockDataSources`).
// - Modo `api`: un `ApiDataSource` por pista contra `GET {apiBaseUrl}/courts/:id`
//   (ver contrato en `apiContract.ts`).
//
// Fallback a mock: las fuentes de API se **siembran con los datos mock** de esa
// pista, así que hasta la primera respuesta —y si la API no está disponible— la
// pantalla muestra datos con sentido en vez de quedar vacía. El `ApiDataSource`
// ya encamina los errores de red a `onError` sin romper el sondeo y se recupera
// solo cuando la API vuelve, de modo que un corte de red degrada a mock sin caer.

/** Opciones de la factoría; todas opcionales e inyectables para los tests. */
export interface CreateDataSourcesOptions {
  /**
   * Configuración ya resuelta. Si se omite, se lee del entorno con
   * `resolveDataSourceConfig()` (`VITE_DATA_SOURCE` / `?source=`).
   */
  config?: DataSourceConfig;
  /** Milisegundos entre puntos simulados en modo mock. */
  intervalMs?: number;
  /** Milisegundos entre sondeos en modo API. */
  apiIntervalMs?: number;
  /** `fetch` inyectable para el modo API (por defecto `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Aleatoriedad inyectable para el modo mock (por defecto `Math.random`). */
  random?: () => number;
  /** Callback para errores de red/parseo del modo API (por defecto no-op). */
  onError?: (error: unknown) => void;
}

/**
 * Crea `n` fuentes de datos —una por pista— según la configuración.
 *
 * @param n Número de pistas/fuentes a crear.
 * @param options Opciones y config (por defecto se resuelve del entorno).
 */
export function createDataSources(
  n: number,
  options: CreateDataSourcesOptions = {},
): DataSource[] {
  const config = options.config ?? resolveDataSourceConfig();

  if (config.kind === 'api') {
    // Una fuente de API por pista, sembrada con la pista mock homónima: ese
    // `Court` es el estado inicial (y de respaldo) hasta que llega la red.
    return createMockCourts(n).map(
      (seed) =>
        new ApiDataSource({
          url: `${config.apiBaseUrl}/courts/${seed.id}`,
          initialCourt: seed,
          intervalMs: options.apiIntervalMs,
          fetch: options.fetch,
          onError: options.onError,
        }),
    );
  }

  // Comportamiento actual: N fuentes mock diferenciadas.
  return createMockDataSources(n, {
    intervalMs: options.intervalMs,
    random: options.random,
  });
}
