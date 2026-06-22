import { describe, it, expect } from 'vitest';
import type { Score } from '../types';
import { advanceScore, isMatchOver } from './score';

function makeScore(overrides: Partial<Score> = {}): Score {
  return {
    currentPoint: [0, 0],
    games: [[0, 0]],
    sets: [0, 0],
    ...overrides,
  };
}

describe('advanceScore — puntos', () => {
  it('avanza 0 → 15 → 30 → 40', () => {
    let score = makeScore();
    score = advanceScore(score, 0);
    expect(score.currentPoint).toEqual([15, 0]);
    score = advanceScore(score, 0);
    expect(score.currentPoint).toEqual([30, 0]);
    score = advanceScore(score, 0);
    expect(score.currentPoint).toEqual([40, 0]);
  });

  it('no muta el marcador de entrada', () => {
    const score = makeScore();
    advanceScore(score, 0);
    expect(score.currentPoint).toEqual([0, 0]);
  });
});

describe('advanceScore — juegos', () => {
  it('gana el juego desde 40 contra menos de 40', () => {
    const score = makeScore({ currentPoint: [40, 30] });
    const next = advanceScore(score, 0);
    expect(next.games[0]).toEqual([1, 0]);
    expect(next.currentPoint).toEqual([0, 0]);
  });

  it('40-40 lleva a Ventaja y luego a juego', () => {
    let score = makeScore({ currentPoint: [40, 40] });
    score = advanceScore(score, 0);
    expect(score.currentPoint).toEqual(['Ventaja', 40]);
    score = advanceScore(score, 0);
    expect(score.games[0]).toEqual([1, 0]);
    expect(score.currentPoint).toEqual([0, 0]);
  });

  it('la Ventaja perdida vuelve a deuce', () => {
    const score = makeScore({ currentPoint: ['Ventaja', 40] });
    const next = advanceScore(score, 1);
    expect(next.currentPoint).toEqual([40, 40]);
  });
});

describe('advanceScore — sets', () => {
  it('cierra el set al llegar a 6 con margen y abre el siguiente', () => {
    const score = makeScore({ currentPoint: [40, 0], games: [[5, 0]] });
    const next = advanceScore(score, 0);
    expect(next.sets).toEqual([1, 0]);
    expect(next.games).toEqual([[6, 0], [0, 0]]);
  });

  it('no cierra el set a 6-5 (hace falta margen de 2)', () => {
    const score = makeScore({ currentPoint: [40, 0], games: [[5, 5]] });
    const next = advanceScore(score, 0);
    expect(next.sets).toEqual([0, 0]);
    expect(next.games[0]).toEqual([6, 5]);
  });

  it('cierra el set a 7-6', () => {
    const score = makeScore({ currentPoint: [40, 0], games: [[6, 6]] });
    const next = advanceScore(score, 0);
    expect(next.sets).toEqual([1, 0]);
  });
});

describe('isMatchOver', () => {
  it('detecta el final al ganar 2 sets', () => {
    expect(isMatchOver(makeScore({ sets: [2, 0] }))).toBe(true);
    expect(isMatchOver(makeScore({ sets: [1, 1] }))).toBe(false);
  });

  it('no abre un nuevo set al ganar el partido', () => {
    const score = makeScore({ currentPoint: [40, 0], games: [[5, 0]], sets: [1, 0] });
    const next = advanceScore(score, 0);
    expect(next.sets).toEqual([2, 0]);
    expect(next.games).toHaveLength(1);
    expect(isMatchOver(next)).toBe(true);
  });

  it('devuelve el mismo marcador si el partido ya terminó', () => {
    const score = makeScore({ sets: [2, 0] });
    expect(advanceScore(score, 1)).toBe(score);
  });
});
