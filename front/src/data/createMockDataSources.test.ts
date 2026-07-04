import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDataSources } from './createMockDataSources';

describe('createMockDataSources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('crea una MockDataSource por pista con ids y nombres únicos', () => {
    const sources = createMockDataSources(4);
    expect(sources).toHaveLength(4);

    const ids = sources.map((s) => s.getCourt().id);
    const names = sources.map((s) => s.getCourt().name);
    expect(new Set(ids).size).toBe(4);
    expect(new Set(names).size).toBe(4);
  });

  it('propaga las opciones comunes a cada fuente (p. ej. intervalMs)', () => {
    // random () => 0 → siempre gana el equipo 0, avance predecible.
    const sources = createMockDataSources(2, { intervalMs: 100, random: () => 0 });
    const listener = vi.fn();
    sources[0].subscribe(listener);

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledTimes(1);

    sources.forEach((s) => s.stop());
  });

  it('los partidos avanzan de forma independiente entre pistas', () => {
    const sources = createMockDataSources(3, { intervalMs: 100, random: () => 0 });

    // Solo suscribimos (y por tanto arrancamos) la pista 1.
    sources[1].subscribe(() => {});
    vi.advanceTimersByTime(300);

    const before = sources.map((s) => JSON.stringify(s.getCourt().match!.score));
    // Solo la pista suscrita cambió respecto a su semilla; las otras siguen igual.
    const seeds = createMockDataSources(3).map((s) =>
      JSON.stringify(s.getCourt().match!.score),
    );

    expect(before[1]).not.toBe(seeds[1]);
    expect(before[0]).toBe(seeds[0]);
    expect(before[2]).toBe(seeds[2]);

    sources.forEach((s) => s.stop());
  });

  it('avanzar una pista no muta el estado de las demás', () => {
    const sources = createMockDataSources(2, { intervalMs: 100, random: () => 0 });
    const other = sources[1].getCourt();

    sources[0].subscribe(() => {});
    vi.advanceTimersByTime(500);

    // La referencia de la otra pista no fue tocada por los ticks de la primera.
    expect(sources[1].getCourt()).toBe(other);

    sources.forEach((s) => s.stop());
  });
});
