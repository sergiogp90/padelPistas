import { describe, it, expect } from 'vitest';
import type { ApiCourt } from './apiContract';
import { mapApiCourt, mapApiCourts } from './mapApiCourt';

// Ejemplo de payload tal como llegaría de `GET /api/courts/:id`: pista con
// partido en curso. Sirve de base para los tests; cada caso lo ajusta a medida.
const courtWithMatch: ApiCourt = {
  id: 1,
  name: 'Pista Central',
  match: {
    teams: [
      {
        players: [
          { name: 'Carlos Ruiz', gender: 'male' },
          { name: 'Miguel Sánchez', gender: 'male' },
        ],
      },
      {
        players: [
          { name: 'Lucía Fernández', gender: 'female' },
          { name: 'Marta Gómez', gender: 'female' },
        ],
      },
    ],
    score: {
      currentPoint: [30, 15],
      games: [[6, 4], [3, 2]],
      sets: [1, 0],
    },
  },
};

describe('mapApiCourt', () => {
  it('mapea una pista con partido al dominio conservando los datos', () => {
    expect(mapApiCourt(courtWithMatch)).toEqual({
      id: 1,
      name: 'Pista Central',
      match: {
        teams: [
          {
            players: [
              { name: 'Carlos Ruiz', gender: 'male' },
              { name: 'Miguel Sánchez', gender: 'male' },
            ],
          },
          {
            players: [
              { name: 'Lucía Fernández', gender: 'female' },
              { name: 'Marta Gómez', gender: 'female' },
            ],
          },
        ],
        score: {
          currentPoint: [30, 15],
          games: [[6, 4], [3, 2]],
          sets: [1, 0],
        },
      },
    });
  });

  it('cubre la pista sin partido (match: null)', () => {
    const freeCourt: ApiCourt = { id: 2, name: 'Pista Norte', match: null };
    expect(mapApiCourt(freeCourt)).toEqual({
      id: 2,
      name: 'Pista Norte',
      match: null,
    });
  });

  it('traduce el token "AD" del contrato a la "Ventaja" del dominio', () => {
    const dto: ApiCourt = {
      ...courtWithMatch,
      match: {
        ...courtWithMatch.match!,
        score: { ...courtWithMatch.match!.score, currentPoint: ['AD', 40] },
      },
    };
    expect(mapApiCourt(dto).match?.score.currentPoint).toEqual(['Ventaja', 40]);
  });

  it('lanza un error claro ante un punto desconocido en el payload', () => {
    const dto = {
      ...courtWithMatch,
      match: {
        ...courtWithMatch.match!,
        // Simula un JSON malformado: los tipos se borran en runtime.
        score: { ...courtWithMatch.match!.score, currentPoint: [50, 15] },
      },
    } as unknown as ApiCourt;
    expect(() => mapApiCourt(dto)).toThrow(/punto desconocido/);
  });

  it('no comparte referencias de arrays con el DTO de entrada', () => {
    const domain = mapApiCourt(courtWithMatch);
    const score = domain.match!.score;
    // Mutar el resultado no debe alterar el DTO original, y viceversa.
    score.games[0][0] = 99;
    expect(courtWithMatch.match!.score.games[0][0]).toBe(6);
    expect(score.games).not.toBe(courtWithMatch.match!.score.games);
    expect(score.sets).not.toBe(courtWithMatch.match!.score.sets);
  });
});

describe('mapApiCourts', () => {
  it('mapea el listado (GET /api/courts) preservando el orden', () => {
    const list: ApiCourt[] = [
      courtWithMatch,
      { id: 2, name: 'Pista Norte', match: null },
    ];
    const domain = mapApiCourts(list);
    expect(domain).toHaveLength(2);
    expect(domain[0].id).toBe(1);
    expect(domain[1]).toEqual({ id: 2, name: 'Pista Norte', match: null });
  });

  it('devuelve un array vacío para un listado vacío', () => {
    expect(mapApiCourts([])).toEqual([]);
  });
});
