import type { Court } from '../types';
import type { ApiCourt } from './apiContract';
import type {
  ConnectionStatus,
  StatusReportingDataSource,
} from './DataSource';
import { mapApiCourt } from './mapApiCourt';
import { backoffDelay } from '../resilience/backoff';
import {
  API_BACKOFF_FACTOR,
  API_MAX_BACKOFF_MS,
  API_OFFLINE_THRESHOLD,
  API_RETRY_BASE_MS,
} from '../resilience/config';

// Implementación de `DataSource` que obtiene el estado de una pista de la API
// propia y notifica los cambios por *polling*.
//
// Al llegar el primer suscriptor arranca un bucle que pide el estado al endpoint,
// traduce el DTO al dominio con `mapApiCourt` (ver #100) y notifica a los
// suscriptores. Cuando se va el último suscriptor, el bucle se detiene solo. El
// `fetch` es inyectable para los tests.
//
// Resiliencia (ver #103 y `src/resilience`): un fallo de red NO detiene el
// sondeo. En vez de un intervalo fijo, el bucle se auto-agenda: tras un sondeo
// correcto vuelve a pedir a los `intervalMs` habituales; tras un fallo reintenta
// con *backoff* exponencial (`backoff.ts`), más rápido al principio para
// recuperarse de un microcorte y relajándose hasta un tope si la API sigue caída.
// Además expone el estado de la conexión (`connecting`/`online`/`offline`) para
// que la TV pueda señalar «sin datos»/«reconectando»; se vuelve a `online` en
// cuanto la API responde. Hasta la primera respuesta —y mientras esté caída— se
// sigue mostrando el `initialCourt` de respaldo, así la pantalla nunca queda vacía.

export interface ApiDataSourceOptions {
  /** URL del endpoint de la pista, p.ej. `/api/courts/1`. */
  url: string;
  /**
   * Estado inicial que devuelve `getCourt()` hasta que llega la primera
   * respuesta. Se clona para no mutar el original. La interfaz `DataSource`
   * exige un `Court` síncrono, y por red no lo tenemos hasta el primer fetch.
   */
  initialCourt: Court;
  /** Milisegundos entre sondeos correctos (por defecto 5000). */
  intervalMs?: number;
  /** `fetch` inyectable para los tests (por defecto `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Callback para errores de red/parseo (por defecto no-op). */
  onError?: (error: unknown) => void;
  /** Callback para los cambios de estado de conexión (por defecto no-op). */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Fallos seguidos para dar la pista por «sin datos». Por defecto `API_OFFLINE_THRESHOLD`. */
  offlineThreshold?: number;
  /** Retardo del primer reintento (ms). Por defecto `API_RETRY_BASE_MS`. */
  retryBaseMs?: number;
  /** Tope del retardo de reintento (ms). Por defecto `API_MAX_BACKOFF_MS`. */
  maxBackoffMs?: number;
  /** Factor de crecimiento del *backoff*. Por defecto `API_BACKOFF_FACTOR`. */
  backoffFactor?: number;
}

type Listener = (court: Court) => void;
type StatusListener = (status: ConnectionStatus) => void;

export class ApiDataSource implements StatusReportingDataSource {
  private court: Court;
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<StatusListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly intervalMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly onError: (error: unknown) => void;
  private readonly onStatusChange: (status: ConnectionStatus) => void;
  private readonly offlineThreshold: number;
  private readonly retryBaseMs: number;
  private readonly maxBackoffMs: number;
  private readonly backoffFactor: number;
  // `true` mientras el bucle de sondeo está activo (hay suscriptores).
  private running = false;
  // Evita solapar peticiones si la red va más lenta que el intervalo.
  private inFlight = false;
  // Estado de la conexión y racha de fallos consecutivos para el *backoff*.
  private status: ConnectionStatus = 'connecting';
  private consecutiveFailures = 0;
  // Marca la "sesión" de sondeo activa: al parar/reiniciar se incrementa para
  // que una respuesta en vuelo de una sesión anterior no notifique datos viejos.
  private generation = 0;

  constructor(options: ApiDataSourceOptions) {
    this.url = options.url;
    this.intervalMs = options.intervalMs ?? 5000;
    // `fetch` nativo debe invocarse con `this === globalThis`; al guardarlo en una
    // propiedad y llamarlo como `this.fetchFn(...)` perdería ese enlace y lanzaría
    // "Illegal invocation". Por eso se enlaza. Un `fetch` inyectado (tests) es una
    // función normal y no lo necesita, pero enlazarlo también es inocuo.
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.onError = options.onError ?? (() => {});
    this.onStatusChange = options.onStatusChange ?? (() => {});
    this.offlineThreshold = options.offlineThreshold ?? API_OFFLINE_THRESHOLD;
    this.retryBaseMs = options.retryBaseMs ?? API_RETRY_BASE_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? API_MAX_BACKOFF_MS;
    this.backoffFactor = options.backoffFactor ?? API_BACKOFF_FACTOR;
    // Clonado profundo para no mutar el Court semilla que nos pasan.
    this.court = structuredClone(options.initialCourt);
  }

  getCourt(): Court {
    return this.court;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Arranca el sondeo con la primera suscripción.
    this.start();

    return () => {
      this.listeners.delete(listener);
      // Sin suscriptores no tiene sentido seguir pidiendo a la red.
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Arranca el bucle con un sondeo inmediato (idempotente). */
  start(): void {
    if (this.running) return;
    this.running = true;
    // Sondeo inmediato para emitir el estado real cuanto antes; él mismo agenda
    // el siguiente al terminar (intervalo normal o *backoff* según el resultado).
    void this.poll();
  }

  /** Detiene el bucle y libera el temporizador (idempotente). */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    // Nueva generación: descarta respuestas en vuelo de la sesión que paramos.
    this.generation++;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Agenda el siguiente sondeo tras `delayMs`, salvo que se haya parado. */
  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, delayMs);
  }

  /** Pide el estado a la API, lo mapea al dominio y notifica; luego se re-agenda. */
  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    const generation = this.generation;
    // Por defecto, tras un ciclo se vuelve a sondear al intervalo normal.
    let nextDelay = this.intervalMs;
    try {
      const response = await this.fetchFn(this.url);
      if (!response.ok) {
        throw new Error(
          `ApiDataSource: respuesta HTTP ${response.status} al pedir ${this.url}`,
        );
      }
      const dto = (await response.json()) as ApiCourt;
      const court = mapApiCourt(dto);
      // Si nos pararon o reiniciaron mientras esperábamos, descartamos.
      if (generation !== this.generation) return;
      this.court = court;
      this.consecutiveFailures = 0;
      this.setStatus('online');
      this.notify();
    } catch (error) {
      // Descarta el fallo si nos pararon mientras la petición estaba en vuelo.
      if (generation !== this.generation) return;
      this.consecutiveFailures++;
      // Tras varios fallos seguidos, la pista se da por «sin datos». El sondeo
      // NO se detiene: se reintenta con *backoff* hasta que la API vuelva.
      if (this.consecutiveFailures >= this.offlineThreshold) {
        this.setStatus('offline');
      }
      nextDelay = backoffDelay(this.consecutiveFailures, {
        baseMs: this.retryBaseMs,
        maxMs: this.maxBackoffMs,
        factor: this.backoffFactor,
      });
      this.onError(error);
    } finally {
      this.inFlight = false;
      // Re-agenda solo si esta sigue siendo la sesión activa (no nos pararon).
      if (generation === this.generation) this.scheduleNext(nextDelay);
    }
  }

  /** Cambia el estado de conexión y avisa a los suscriptores si de verdad cambió. */
  private setStatus(next: ConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.onStatusChange(next);
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.court);
    }
  }
}
