import type { Court, Point, Score } from '../types';
import { mockCourt } from './mockCourt';
import type { DataSource } from './DataSource';

// Implementación de `DataSource` que simula un partido en vivo a partir de los
// datos mock. Avanza el marcador punto a punto con un temporizador y notifica a
// los suscriptores en cada cambio, de modo que la UI pueda re-renderizarse sola
// sin conocer el origen real de los datos (ver `docs/architecture.md`).

/** Secuencia de puntos de un juego de pádel antes de la ventaja. */
const POINT_LADDER: Point[] = [0, 15, 30, 40];

/** Intervalo por defecto entre puntos simulados (ms). */
const DEFAULT_INTERVAL_MS = 2000;

/** Clona en profundidad un `Court` para no mutar la constante `mockCourt`. */
function cloneCourt(court: Court): Court {
  return JSON.parse(JSON.stringify(court)) as Court;
}

/**
 * Aplica un punto ganado por `winner` (0 ó 1) sobre `score`, mutándolo.
 * Resuelve la transición de punto → juego → set siguiendo un marcador de pádel
 * simplificado (ventaja clásica; set ganado con 6 juegos y 2 de diferencia).
 * Devuelve `true` si el partido ha terminado (un equipo llega a 2 sets).
 */
function scorePoint(score: Score, winner: 0 | 1): boolean {
  const loser = winner === 0 ? 1 : 0;
  const me = score.currentPoint[winner];
  const rival = score.currentPoint[loser];

  if (me === 'Ventaja') {
    return winGame(score, winner);
  }
  if (me === 40) {
    if (rival === 40) {
      score.currentPoint[winner] = 'Ventaja';
      return false;
    }
    if (rival === 'Ventaja') {
      // El rival tenía ventaja: vuelta a iguales (40-40).
      score.currentPoint[loser] = 40;
      return false;
    }
    return winGame(score, winner);
  }

  // Avance normal por la escalera 0 → 15 → 30 → 40.
  const next = POINT_LADDER[POINT_LADDER.indexOf(me) + 1];
  score.currentPoint[winner] = next;
  return false;
}

/** Suma un juego a `winner`, reinicia el punto y resuelve el set. */
function winGame(score: Score, winner: 0 | 1): boolean {
  const currentSet = score.games[score.games.length - 1];
  currentSet[winner] += 1;
  score.currentPoint = [0, 0];

  const mine = currentSet[winner];
  const theirs = currentSet[winner === 0 ? 1 : 0];
  if (mine >= 6 && mine - theirs >= 2) {
    score.sets[winner] += 1;
    if (score.sets[winner] >= 2) {
      return true; // Partido terminado.
    }
    // Nuevo set en curso.
    score.games.push([0, 0]);
  }
  return false;
}

export class MockDataSource implements DataSource {
  private court: Court;
  private listeners = new Set<(court: Court) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;

  constructor(intervalMs: number = DEFAULT_INTERVAL_MS) {
    this.court = cloneCourt(mockCourt);
    this.intervalMs = intervalMs;
  }

  getCourt(): Court {
    return this.court;
  }

  subscribe(listener: (court: Court) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Arranca la simulación: avanza un punto cada `intervalMs`. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.advance(), this.intervalMs);
  }

  /** Detiene la simulación. */
  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Avanza un punto del partido y notifica a los suscriptores. Si el partido
   * termina, reinicia desde el estado mock para que la demo no se quede quieta.
   */
  advance(): void {
    if (!this.court.match) return;

    const winner: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    const finished = scorePoint(this.court.match.score, winner);

    if (finished) {
      this.court = cloneCourt(mockCourt);
    }
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.court);
    }
  }
}
