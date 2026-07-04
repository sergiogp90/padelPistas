import type { Court } from '../types';
import type { ApiCourt } from './apiContract';
import type { DataSource } from './DataSource';
import { mapApiCourt } from './mapApiCourt';

// Implementación de `DataSource` que obtiene el estado de una pista de la API
// propia y notifica los cambios por *polling*.
//
// Al llegar el primer suscriptor arranca un temporizador que pide el estado al
// endpoint cada `intervalMs`, traduce el DTO al dominio con `mapApiCourt`
// (ver #100) y notifica a los suscriptores. Cuando se va el último suscriptor,
// el temporizador se detiene solo. El `fetch` es inyectable para los tests y
// los errores de red/parseo se encaminan a `onError` sin romper el sondeo.

export interface ApiDataSourceOptions {
  /** URL del endpoint de la pista, p.ej. `/api/courts/1`. */
  url: string;
  /**
   * Estado inicial que devuelve `getCourt()` hasta que llega la primera
   * respuesta. Se clona para no mutar el original. La interfaz `DataSource`
   * exige un `Court` síncrono, y por red no lo tenemos hasta el primer fetch.
   */
  initialCourt: Court;
  /** Milisegundos entre sondeos (por defecto 5000). */
  intervalMs?: number;
  /** `fetch` inyectable para los tests (por defecto `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Callback para errores de red/parseo (por defecto no-op). */
  onError?: (error: unknown) => void;
}

type Listener = (court: Court) => void;

export class ApiDataSource implements DataSource {
  private court: Court;
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly url: string;
  private readonly intervalMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly onError: (error: unknown) => void;
  // Evita solapar peticiones si la red va más lenta que el intervalo.
  private inFlight = false;
  // Marca la "sesión" de sondeo activa: al parar/reiniciar se incrementa para
  // que una respuesta en vuelo de una sesión anterior no notifique datos viejos.
  private generation = 0;

  constructor(options: ApiDataSourceOptions) {
    this.url = options.url;
    this.intervalMs = options.intervalMs ?? 5000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.onError = options.onError ?? (() => {});
    // Clonado profundo para no mutar el Court semilla que nos pasan.
    this.court = structuredClone(options.initialCourt);
  }

  getCourt(): Court {
    return this.court;
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

  /** Arranca el temporizador con un sondeo inmediato (idempotente). */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
    // Sondeo inmediato para emitir el estado real cuanto antes.
    void this.poll();
  }

  /** Detiene el temporizador y libera el recurso (idempotente). */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.generation++;
    }
  }

  /** Pide el estado a la API, lo mapea al dominio y notifica. */
  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    const generation = this.generation;
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
      this.notify();
    } catch (error) {
      this.onError(error);
    } finally {
      this.inFlight = false;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.court);
    }
  }
}
