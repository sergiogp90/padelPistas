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
// el `Court` **real** que devuelve el propio listado, así la pantalla muestra ya
// datos con sentido antes del primer sondeo individual.
//
// Sin datos mock en modo `api` (ver issue #130): si el listado no está disponible
// (red caída, HTTP no-OK, JSON inválido o lista vacía) la factoría **no** inventa
// pistas mock; **reintenta** el listado con *backoff* exponencial hasta que la API
// responda, encaminando cada fallo a `onError` para que la TV muestre el aviso de
// «reintentando conectar». En cuanto la API se pone operativa, el listado llega y
// se construyen las pistas reales. El `ApiDataSource` de cada pista ya encamina los
// errores de sondeo a `onError` sin romper el bucle y se recupera solo al volver.

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
  listRetryBaseMs?: number;
  /** Tope del retardo de reintento del listado (ms). Por defecto `API_MAX_BACKOFF_MS`. */
  listMaxBackoffMs?: number;
}

/**
 * Crea las fuentes de datos —una por pista— según la configuración.
 *
 * - En modo `mock`, crea exactamente `mockCourtCount` fuentes mock.
 * - En modo `api`, el número de pistas y sus ids salen de `GET /api/courts`; si
 *   ese listado no está disponible se **reintenta** hasta que la API responda
 *   (sin inventar datos mock, ver issue #130), por lo que `mockCourtCount` **no**
 *   se usa en este modo.
 *
 * @param mockCourtCount Nº de pistas del modo `mock` (ignorado en modo `api`).
 * @param options Opciones y config (por defecto se resuelve del entorno).
 */
export async function createDataSources(
  mockCourtCount: number,
  options: CreateDataSourcesOptions = {},
): Promise<DataSource[]> {
  const config = options.config ?? resolveDataSourceConfig();

  if (config.kind === 'api') {
    // Reintenta el listado hasta obtenerlo: en modo `api` NO hay datos mock de
    // respaldo (issue #130). Cada fallo se encamina a `onError` para que la TV
    // avise de que se está reintentando conectar.
    const courts = await fetchCourtListWithRetry(config, options);

    // Una fuente de API por pista devuelta por el listado. El `Court` real del
    // propio listado es el estado inicial (y de respaldo) hasta el primer sondeo.
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
  return createMockDataSources(mockCourtCount, {
    intervalMs: options.intervalMs,
    random: options.random,
  });
}

/**
 * Pide el listado `GET {apiBaseUrl}/courts` una y otra vez, con *backoff*
 * exponencial entre intentos, hasta obtener una lista válida y no vacía. En modo
 * `api` no hay respaldo mock (issue #130): si la API está inactiva la pantalla
 * espera —avisando por `onError` en cada intento— y arranca en cuanto responde.
 */
async function fetchCourtListWithRetry(
  config: DataSourceConfig,
  options: CreateDataSourcesOptions,
): Promise<Court[]> {
  const baseMs = options.listRetryBaseMs ?? API_RETRY_BASE_MS;
  const maxMs = options.listMaxBackoffMs ?? API_MAX_BACKOFF_MS;

  // Reintento indefinido: la TV funciona desatendida y debe recuperarse sola en
  // cuanto la API vuelva, sin mostrar datos inventados mientras tanto.
  for (let attempt = 1; ; attempt++) {
    const courts = await fetchCourtList(config, options);
    if (courts !== null) return courts;

    const delay = backoffDelay(attempt, {
      baseMs,
      maxMs,
      factor: API_BACKOFF_FACTOR,
    });
    await sleep(delay);
  }
}

/** Espera `ms` milisegundos (temporizador real; los tests usan *fake timers*). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pide el listado `GET {apiBaseUrl}/courts` y lo mapea al dominio. Devuelve las
 * pistas, o `null` si el listado no está disponible (red caída, HTTP no-OK, JSON
 * inválido o lista vacía) para que la factoría reintente.
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
