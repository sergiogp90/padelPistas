import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Court } from '../types';
import type { DataSource } from './DataSource';
import { MockDataSource } from './MockDataSource';

// Pista semilla mínima con un partido recién empezado.
function seedCourt(): Court {
  return {
    id: 1,
    name: 'Pista Test',
    match: {
      teams: [
        { players: [{ name: 'A1' }, { name: 'A2' }] },
        { players: [{ name: 'B1' }, { name: 'B2' }] },
      ],
      score: { currentPoint: [0, 0], games: [[0, 0]], sets: [0, 0] },
    },
  };
}

describe('MockDataSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('implementa la interfaz DataSource', () => {
    const source: DataSource = new MockDataSource({ seed: seedCourt() });
    expect(typeof source.getCourt).toBe('function');
    expect(typeof source.subscribe).toBe('function');
  });

  it('no muta la pista semilla original', () => {
    const seed = seedCourt();
    const source = new MockDataSource({ seed, intervalMs: 100, random: () => 0 });
    source.subscribe(() => {});
    vi.advanceTimersByTime(100);
    expect(seed.match?.score.currentPoint).toEqual([0, 0]);
    source.stop();
  });

  it('el Court evoluciona con el tiempo y notifica a los suscriptores', () => {
    // random < 0.5 → siempre gana el equipo 0.
    const source = new MockDataSource({ seed: seedCourt(), intervalMs: 100, random: () => 0 });
    const listener = vi.fn();
    source.subscribe(listener);

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getCourt().match?.score.currentPoint).toEqual([15, 0]);

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(source.getCourt().match?.score.currentPoint).toEqual([30, 0]);

    source.stop();
  });

  it('cancelar la suscripción detiene las notificaciones y el temporizador', () => {
    const source = new MockDataSource({ seed: seedCourt(), intervalMs: 100, random: () => 0 });
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.advanceTimersByTime(500);
    // Sin más llamadas tras cancelar.
    expect(listener).toHaveBeenCalledTimes(1);
    // El temporizador quedó limpio (no hay timers pendientes).
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() detiene el temporizador explícitamente', () => {
    const source = new MockDataSource({ seed: seedCourt(), intervalMs: 100, random: () => 0 });
    source.subscribe(() => {});
    source.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('se detiene solo cuando el partido termina', () => {
    // Partido a un punto de acabar: equipo 0 con 1 set, 5 juegos y 40.
    const court = seedCourt();
    court.match!.score = { currentPoint: [40, 0], games: [[5, 0]], sets: [1, 0] };
    const source = new MockDataSource({ seed: court, intervalMs: 100, random: () => 0 });
    source.subscribe(() => {});

    vi.advanceTimersByTime(100); // gana set y partido
    expect(source.getCourt().match?.score.sets).toEqual([2, 0]);

    vi.advanceTimersByTime(100); // tick que detecta fin → se para
    expect(vi.getTimerCount()).toBe(0);
  });
});
