import { describe, it, expect, vi } from 'vitest';
import { MockDataSource } from './MockDataSource';
import { mockCourt } from './mockCourt';

describe('MockDataSource', () => {
  it('expone el estado inicial clonado del mock (sin compartir referencia)', () => {
    const source = new MockDataSource();
    const court = source.getCourt();

    expect(court).toEqual(mockCourt);
    expect(court).not.toBe(mockCourt);
    expect(court.match).not.toBe(mockCourt.match);
  });

  it('no muta la constante mockCourt al avanzar', () => {
    const source = new MockDataSource();
    const before = JSON.parse(JSON.stringify(mockCourt));

    for (let i = 0; i < 20; i++) source.advance();

    expect(mockCourt).toEqual(before);
  });

  it('notifica a los suscriptores en cada avance', () => {
    const source = new MockDataSource();
    const listener = vi.fn();
    source.subscribe(listener);

    source.advance();
    source.advance();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(source.getCourt());
  });

  it('deja de notificar tras cancelar la suscripción', () => {
    const source = new MockDataSource();
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    source.advance();
    unsubscribe();
    source.advance();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cambia el marcador al avanzar (gana un punto algún equipo)', () => {
    const source = new MockDataSource();
    const before = JSON.parse(JSON.stringify(source.getCourt().match!.score));

    source.advance();

    const after = source.getCourt().match!.score;
    expect(after).not.toEqual(before);
  });

  it('avanza solo con el temporizador cuando se arranca con start()', () => {
    vi.useFakeTimers();
    try {
      const source = new MockDataSource(1000);
      const listener = vi.fn();
      source.subscribe(listener);

      source.start();
      vi.advanceTimersByTime(3000);
      source.stop();
      vi.advanceTimersByTime(3000);

      expect(listener).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mantiene un marcador de pádel coherente tras muchos puntos', () => {
    const source = new MockDataSource();
    for (let i = 0; i < 500; i++) source.advance();

    const score = source.getCourt().match!.score;
    // Los sets nunca superan el objetivo de 2 (al llegar reinicia la demo).
    expect(score.sets[0]).toBeLessThanOrEqual(2);
    expect(score.sets[1]).toBeLessThanOrEqual(2);
    expect(score.games.length).toBeGreaterThanOrEqual(1);
  });
});
