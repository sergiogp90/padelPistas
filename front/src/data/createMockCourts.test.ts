import { describe, it, expect } from 'vitest';
import { createMockCourts } from './createMockCourts';

describe('createMockCourts', () => {
  it('genera el número de pistas pedido', () => {
    expect(createMockCourts(0)).toHaveLength(0);
    expect(createMockCourts(1)).toHaveLength(1);
    expect(createMockCourts(6)).toHaveLength(6);
  });

  it('asigna ids únicos y correlativos empezando en 1', () => {
    const ids = createMockCourts(6).map((c) => c.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('asigna nombres de pista únicos incluso más allá del catálogo', () => {
    const names = createMockCourts(10).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('cada pista tiene un partido con dos equipos de dos jugadores', () => {
    for (const court of createMockCourts(6)) {
      expect(court.match).not.toBeNull();
      expect(court.match!.teams).toHaveLength(2);
      for (const team of court.match!.teams) {
        expect(team.players).toHaveLength(2);
      }
    }
  });

  it('no repite jugadores entre pistas ni dentro de una pista', () => {
    const names = createMockCourts(6).flatMap((c) =>
      c.match!.teams.flatMap((t) => t.players.map((p) => p.name)),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('las pistas arrancan en marcadores diferenciados', () => {
    const scores = createMockCourts(6).map((c) =>
      JSON.stringify(c.match!.score),
    );
    // Al menos varios puntos de partida distintos entre pistas.
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  it('es determinista: misma entrada, misma salida', () => {
    expect(createMockCourts(4)).toEqual(createMockCourts(4));
  });

  it('devuelve instancias independientes (no comparten referencias de score)', () => {
    const courts = createMockCourts(2);
    courts[0].match!.score.currentPoint[0] = 40;
    expect(courts[1].match!.score.currentPoint[0]).not.toBe(
      courts[0].match!.score.currentPoint,
    );
    // Regenerar no arrastra la mutación anterior.
    expect(createMockCourts(2)[0].match!.score.currentPoint[0]).not.toBe(40);
  });

  it('rechaza valores de n inválidos', () => {
    expect(() => createMockCourts(-1)).toThrow(RangeError);
    expect(() => createMockCourts(1.5)).toThrow(RangeError);
  });
});
