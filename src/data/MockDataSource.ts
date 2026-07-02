import type { Court } from '../types';
import type { DataSource } from './DataSource';
import { mockCourt } from './mockCourt';
import { advanceScore, isMatchOver, type TeamIndex } from './score';

// Implementación de `DataSource` que simula el avance de un partido en vivo.
//
// Parte de un `Court` semilla (por defecto `mockCourt`) y, con un temporizador,
// gana puntos al azar avanzando el marcador con la lógica de `score.ts`. Cada
// cambio se notifica a los suscriptores. Cuando el partido termina, el
// temporizador se detiene solo.

export interface MockDataSourceOptions {
  /** Milisegundos entre puntos simulados (por defecto 2000). */
  intervalMs?: number;
  /** `Court` de partida; se clona para no mutar el original (por defecto `mockCourt`). */
  seed?: Court;
  /** Fuente de aleatoriedad inyectable para los tests (por defecto `Math.random`). */
  random?: () => number;
}

type Listener = (court: Court) => void;

export class MockDataSource implements DataSource {
  private court: Court;
  private readonly listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly random: () => number;

  constructor(options: MockDataSourceOptions = {}) {
    this.intervalMs = options.intervalMs ?? 2000;
    this.random = options.random ?? Math.random;
    // Clonado profundo para no mutar el mock compartido entre instancias/tests.
    this.court = structuredClone(options.seed ?? mockCourt);
  }

  getCourt(): Court {
    return this.court;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Arranca la simulación con la primera suscripción.
    this.start();

    return () => {
      this.listeners.delete(listener);
      // Sin suscriptores no tiene sentido seguir gastando ticks.
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  /** Arranca el temporizador (idempotente). */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  /** Detiene el temporizador y libera el recurso (idempotente). */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Avanza un punto del partido y notifica, o se para si ya ha terminado. */
  private tick(): void {
    const match = this.court.match;
    if (!match || isMatchOver(match.score)) {
      this.stop();
      return;
    }

    const winner: TeamIndex = this.random() < 0.5 ? 0 : 1;
    const score = advanceScore(match.score, winner);
    this.court = { ...this.court, match: { ...match, score } };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.court);
    }
  }
}
