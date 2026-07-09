import type { Court } from '../types';
import type { DataSource } from './DataSource';
import type { ApiCourt } from './apiContract';
import { ApiDataSource } from './ApiDataSource';
import { createMockDataSources } from './createMockDataSources';
import { mapApiCourts } from './mapApiCourt';
import { resolveDataSourceConfig, type DataSourceConfig } from './dataSourceConfig';
import { backoffDelay } from '../resilience/backoff';
import {
  API_BACKOFF_FACTOR,
  API_MAX_BACKOFF_MS,
  API_RETRY_BASE_MS,
} from '../resilience/config';

// Factoría que decide la fuente de datos **por configuración** (mock ⇄ API real)
// sin que el resto de la app —el 3D, la UI, `main.ts`— sepa de dónde salen los
// datos: todas las fuentes cumplen el mismo contrato `DataSource`.
//
// - Modo `mock`: N `MockDataSource` diferenciadas (ver `createMockDataSources`).
//   Solo se usa si se pide de forma explícita (`?source=mock` /
//   `VITE_DATA_SOURCE=mock`), como red de seguridad para desarrollo y demos.
// - Modo `api` (por defecto): el listado `GET {apiBaseUrl}/courts` es la **fuente
//   única de verdad** del número de pistas y sus ids. Se crea un `ApiDataSource`
//   por pista devuelta, cada uno contra `GET {apiBaseUrl}/courts/:id` (ver
//   `apiContract.ts`). Así el front no fija el número de pistas ni pide ids que la
//   API no sirve (evita el bucle de 404 → «sin conexión», ver issue #123).
//
// Como el listado se pide por red, en modo `api` la factoría es **asíncrona**; el
// modo `mock` resuelve al instante (sin red). El estado inicial de cada pista es
// el `Court` que devuelve el propio listado, así la pantalla muestra ya datos con
// sentido antes del primer sondeo individual.
//
// Sin datos mock de respaldo (issue #130): en modo `api` NO se inventan pistas
// mock si el listado no está disponible. Si la API está inactiva (red caída, HTTP
// no-OK, JSON inválido o lista vacía), la factoría **reintenta `GET /courts` con
// *backoff* exponencial** hasta que la API responda, encaminando cada intento
// fallido a `onError` para que la TV avise de que se está reintentando conectar.
// Cuando la API se pone operativa se construyen las pistas **reales**.

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
  /** Retardo del primer reintento del listado (ms). Por defecto `API_RETRY_BASE_MS`. */
  retryBaseMs?: number;
  /** Tope del retardo de reintento del listado (ms). Por defecto `API_MAX_BACKOFF_MS`. */
  maxBackoffMs?: number;
  /** Factor de crecimiento del *backoff* del listado. Por defecto `API_BACKOFF_FACTOR`. */
  backoffFactor?: number;
}

/**
 * Crea las fuentes de datos —una por pista— según la configuración.
 *
 * - En modo `mock`, crea exactamente `mockCount` fuentes mock.
 * - En modo `api`, el número de pistas y sus ids salen de `GET /api/courts`;
 *   si el listado no está disponible, se **reintenta con *backoff*** hasta que la
 *   API responda (no se cae a mock). `mockCount` NO se usa en este modo.
 *
 * @param mockCount Nº de pistas del modo `mock` (ignorado en modo `api`).
 * @param options Opciones y config (por defecto se resuelve del entorno).
 */
export async function createDataSources(
  mockCount: number,
  options: CreateDataSourcesOptions = {},
): Promise<DataSource[]> {
  const config = options.config ?? resolveDataSourceConfig();

  if (config.kind === 'api') {
    // En modo `api` no hay respaldo mock: si la API está inactiva se reintenta el
    // listado hasta que responda (los fallos se encaminan a `onError`).
    const courts = await fetchCourtListWithRetry(config, options);

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

  // Modo `mock` explícito: N fuentes mock diferenciadas.
  return createMockDataSources(mockCount, {
    intervalMs: options.intervalMs,
    random: options.random,
  });
}

/**
 * Pide el listado `GET {apiBaseUrl}/courts` reintentando con *backoff*
 * exponencial hasta que la API responda con pistas. Cada intento fallido (red
 * caída, HTTP no-OK, JSON inválido o lista vacía) se encamina a `onError` y se
 * espera antes del siguiente, de modo que la app arranca sin datos mock y carga
 * las pistas reales en cuanto la API se pone operativa (issue #130).
 */
async function fetchCourtListWithRetry(
  config: DataSourceConfig,
  options: CreateDataSourcesOptions,
): Promise<Court[]> {
  const baseMs = options.retryBaseMs ?? API_RETRY_BASE_MS;
  const maxMs = options.maxBackoffMs ?? API_MAX_BACKOFF_MS;
  const factor = options.backoffFactor ?? API_BACKOFF_FACTOR;

  let attempt = 0;
  for (;;) {
    const courts = await fetchCourtList(config, options);
    if (courts !== null) return courts;

    // Aún no hay listado: esperamos (backoff) y reintentamos indefinidamente.
    attempt++;
    await delay(backoffDelay(attempt, { baseMs, maxMs, factor }));
  }
}

/**
 * Pide el listado `GET {apiBaseUrl}/courts` y lo mapea al dominio. Devuelve las
 * pistas, o `null` si el listado no está disponible (red caída, HTTP no-OK, JSON
 * inválido o lista vacía), encaminando el error a `onError` para que la factoría
 * reintente.
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

/** Promesa que se resuelve tras `ms` (compatible con los timers falsos de los tests). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
