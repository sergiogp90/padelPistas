import { describe, it, expect } from 'vitest';
import type { Score } from '../types';
import { ganarPunto, hayGanadorDePartido, SETS_PARA_GANAR } from '../data/scoring';

/** Crea un `Score` inicial (0-0, primer set en curso) para los tests. */
function scoreInicial(): Score {
  return {
    currentPoint: [0, 0],
    games: [[0, 0]],
    sets: [0, 0],
  };
}

/** Aplica una secuencia de puntos a un `Score` partiendo del estado dado. */
function jugar(score: Score, equipos: (0 | 1)[]): Score {
  return equipos.reduce((acc, equipo) => ganarPunto(acc, equipo), score);
}

describe('ganarPunto · avance de puntos', () => {
  it('avanza 0 → 15 → 30 → 40', () => {
    let score = scoreInicial();
    score = ganarPunto(score, 0);
    expect(score.currentPoint).toEqual([15, 0]);
    score = ganarPunto(score, 0);
    expect(score.currentPoint).toEqual([30, 0]);
    score = ganarPunto(score, 0);
    expect(score.currentPoint).toEqual([40, 0]);
  });

  it('cierra el juego desde 40 con el rival por debajo', () => {
    const score = jugar(scoreInicial(), [0, 0, 0, 0]);
    expect(score.currentPoint).toEqual([0, 0]);
    expect(score.games).toEqual([[1, 0]]);
  });

  it('no muta el `Score` recibido (pureza)', () => {
    const score = scoreInicial();
    const copia: Score = {
      currentPoint: [score.currentPoint[0], score.currentPoint[1]],
      games: score.games.map((s) => [s[0], s[1]] as [number, number]),
      sets: [score.sets[0], score.sets[1]],
    };
    ganarPunto(score, 0);
    expect(score).toEqual(copia);
  });
});

describe('ganarPunto · deuce y ventaja', () => {
  it('llega a 40-40 y otorga la ventaja', () => {
    const score = jugar(scoreInicial(), [0, 0, 0, 1, 1, 1]);
    expect(score.currentPoint).toEqual([40, 40]);
    const conVentaja = ganarPunto(score, 0);
    expect(conVentaja.currentPoint).toEqual(['Ventaja', 40]);
  });

  it('vuelve a deuce si el rival gana el punto con ventaja en contra', () => {
    let score = jugar(scoreInicial(), [0, 0, 0, 1, 1, 1]); // 40-40
    score = ganarPunto(score, 0); // Ventaja-40
    score = ganarPunto(score, 1); // de vuelta a 40-40
    expect(score.currentPoint).toEqual([40, 40]);
  });

  it('cierra el juego cuando se gana el punto con ventaja a favor', () => {
    let score = jugar(scoreInicial(), [0, 0, 0, 1, 1, 1]); // 40-40
    score = ganarPunto(score, 0); // Ventaja-40
    score = ganarPunto(score, 0); // juego para el equipo 0
    expect(score.currentPoint).toEqual([0, 0]);
    expect(score.games).toEqual([[1, 0]]);
  });
});

/** Hace ganar `n` juegos seguidos a `equipo` (rival a 0 en cada juego). */
function ganarJuegos(score: Score, equipo: 0 | 1, n: number): Score {
  let actual = score;
  for (let i = 0; i < n; i++) {
    actual = jugar(actual, [equipo, equipo, equipo, equipo]);
  }
  return actual;
}

describe('ganarPunto · cierre de set', () => {
  it('gana el set con 6 juegos y diferencia de 2 (6-0)', () => {
    const score = ganarJuegos(scoreInicial(), 0, 6);
    expect(score.sets).toEqual([1, 0]);
    // Se abre un nuevo set en curso.
    expect(score.games).toEqual([[6, 0], [0, 0]]);
  });

  it('no cierra el set a 5-5; continúa hasta 7-5', () => {
    let score = scoreInicial();
    score = ganarJuegos(score, 0, 5);
    score = ganarJuegos(score, 1, 5); // 5-5
    expect(score.sets).toEqual([0, 0]);
    score = ganarJuegos(score, 0, 1); // 6-5
    expect(score.sets).toEqual([0, 0]);
    score = ganarJuegos(score, 0, 1); // 7-5
    expect(score.sets).toEqual([1, 0]);
    expect(score.games[0]).toEqual([7, 5]);
  });

  it('aplica el juego decisivo a 6-6 (gana 7-6)', () => {
    let score = scoreInicial();
    score = ganarJuegos(score, 0, 6);
    // Reabrimos manualmente un set 6-6 sería complejo; simulamos 6-5 y 6-6.
    score = scoreInicial();
    score = ganarJuegos(score, 0, 5);
    score = ganarJuegos(score, 1, 6); // 5-6
    expect(score.sets).toEqual([0, 0]);
    score = ganarJuegos(score, 0, 1); // 6-6
    expect(score.sets).toEqual([0, 0]);
    score = ganarJuegos(score, 1, 1); // 7-6
    expect(score.sets).toEqual([0, 1]);
    expect(score.games[0]).toEqual([6, 7]);
  });
});

describe('ganarPunto · cierre de partido', () => {
  it('cierra el partido al ganar 2 sets y no abre un set nuevo', () => {
    let score = scoreInicial();
    score = ganarJuegos(score, 0, 6); // set 1: 6-0
    score = ganarJuegos(score, 0, 6); // set 2: 6-0 → partido
    expect(score.sets).toEqual([SETS_PARA_GANAR, 0]);
    expect(hayGanadorDePartido(score.sets)).toBe(true);
    // No se abre un set adicional tras cerrar el partido.
    expect(score.games).toEqual([[6, 0], [6, 0]]);
  });

  it('ignora puntos posteriores al cierre del partido', () => {
    let score = scoreInicial();
    score = ganarJuegos(score, 0, 6);
    score = ganarJuegos(score, 0, 6); // partido cerrado
    const despues = ganarPunto(score, 1);
    expect(despues).toBe(score);
  });
});
