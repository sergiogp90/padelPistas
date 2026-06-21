import type { Court } from '../types';

export const mockCourt: Court = {
  id: 1,
  name: 'Pista Central',
  match: {
    teams: [
      { players: [{ name: 'Carlos Ruiz' }, { name: 'Miguel Sánchez' }] },
      { players: [{ name: 'Pablo García' }, { name: 'Javier López' }] },
    ],
    score: {
      currentPoint: [30, 15],
      // Set 1 completado (6-4), set 2 en curso (3-2)
      games: [[6, 4], [3, 2]],
      sets: [1, 0],
    },
  },
};
