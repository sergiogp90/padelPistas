import type { Court } from '../types';
import type { DataSource } from './DataSource';
import type { ApiCourt } from './apiContract';
import { ApiDataSource } from './ApiDataSource';
import { createMockDataSources } from './createMockDataSources';
import { mapApiCourts } from './mapApiCourt';
import { resolveDataSourceConfig, type DataSourceConfig } from './dataSourceConfig';

// Factoría que decide la fuente de datos **por configuración** (mock ⇄ API real)
// sin que el resto de la app —el 3D, la UI, `main.ts`— sepa de dónde salen los
// datos: todas las fuentes cumplen el mismo contrato `DataSource`.
//
// - Modo `mock` (por defecto): N `MockDataSource` diferenciadas, igual que hasta
//   ahora (ver `createMockDataSources`).
// - Modo `api`: el listado `GET {apiBaseUrl}/courts` es la **fuente única de
//   verdad** del número de pistas y sus ids. Se crea un `ApiDataSource` por pista
//   devuelta, cada uno contra `GET {apiBaseUrl}/courts/:id` (ver `apiContract.ts`).
//   Así el front no fija el número de pistas ni pide ids que la API no sirve
//   (evita el bucle de 404 → «sin conexión», ver issue #123).
//
// Como el listado se pide por red, en modo `api` la factoría es **asíncrona**; el
// modo `mock` resuelve al instante (sin red). El estado inicial de cada pista es
// el `Court` que devuelve el propio listado, así la pantalla muestra ya datos con
// sentido antes del primer sondeo individual.
//
// Fallback a mock: si el listado falla (red caída, HTTP no-OK, JSON inválido) o
// llega vacío, la factoría degrada a `MockDataSource` locales usando `fallbackCount`
// como número de pistas, de modo que la pantalla nunca queda vacía y no se sondean
// ids inexistentes. El `ApiDataSource` de cada pista ya encamina los errores de red
// a `onError` sin romper el sondeo y se recupera solo cuando la API vuelve.

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
 * Crea las fuentes de datos —una por pista— según la configuración.
 *
 * - En modo `mock`, crea exactamente `fallbackCount` fuentes mock.
 * - En modo `api`, el número de pistas y sus ids salen de `GET /api/courts`;
 *   `fallbackCount` solo se usa como red de seguridad si ese listado no está
 *   disponible.
 *
 * @param fallbackCount Nº de pistas mock (y de respaldo si el listado API falla).
 * @param options Opciones y config (por defecto se resuelve del entorno).
 */
export async function createDataSources(
  fallbackCount: number,
  options: CreateDataSourcesOptions = {},
): Promise<DataSource[]> {
  const config = options.config ?? resolveDataSourceConfig();

  if (config.kind === 'api') {
    const courts = await fetchCourtList(config, options);

    if (courts === null) {
      // El listado no está disponible: degradamos a mock local para no dejar la
      // pantalla vacía ni sondear ids que la API quizá no sirve.
      return createMockDataSources(fallbackCount, {
        intervalMs: options.intervalMs,
        random: options.random,
      });
    }

    // Una fuente de API por pista devuelta por el listado. El `Court` del propio
    // listado es el estado inicial (y de respaldo) hasta que llega el primer sondeo.
    return courts.map(
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
  return createMockDataSources(fallbackCount, {
    intervalMs: options.intervalMs,
    random: options.random,
  });
}

/**
 * Pide el listado `GET {apiBaseUrl}/courts` y lo mapea al dominio. Devuelve las
 * pistas, o `null` si el listado no está disponible (red caída, HTTP no-OK, JSON
 * inválido o lista vacía) para que la factoría pueda degradar al mock.
 */
async function fetchCourtList(
  config: DataSourceConfig,
  options: CreateDataSourcesOptions,
): Promise<Court[] | null> {
  // Mismo enlace de `fetch` que `ApiDataSource`: el `fetch` nativo exige
  // `this === globalThis`; un `fetch` inyectado (tests) no lo necesita, pero
  // enlazarlo es inocuo.
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  try {
    const response = await fetchFn(`${config.apiBaseUrl}/courts`);
    if (!response.ok) {
      throw new Error(
        `createDataSources: respuesta HTTP ${response.status} al pedir ${config.apiBaseUrl}/courts`,
      );
    }
    const dtos = (await response.json()) as ApiCourt[];
    const courts = mapApiCourts(dtos);
    if (courts.length === 0) {
      throw new Error('createDataSources: el listado de pistas llegó vacío');
    }
    return courts;
  } catch (error) {
    options.onError?.(error);
    return null;
  }
}
