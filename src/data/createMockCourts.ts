import type { Court, Point } from '../types';

// Semilla de N pistas mock con datos diferenciados, pensada para la rejilla del
// hito M3. Cada pista tiene id y nombre únicos, parejas distintas y un marcador
// en un punto diferente del partido, de modo que la rejilla no muestre N copias
// iguales.
//
// La generación es determinista (sin `Math.random`): dado el mismo `n` produce
// siempre las mismas pistas, lo que hace los tests fiables y reproducibles.

/** Nombres de pista; si `n` los supera, se completa con "Pista N". */
const COURT_NAMES = [
  'Pista Central',
  'Pista Norte',
  'Pista Sur',
  'Pista Este',
  'Pista Oeste',
  'Pista Río',
];

/** Cantera de jugadores; se reparten en grupos de 4 por pista. */
const PLAYER_NAMES = [
  'Carlos Ruiz',
  'Miguel Sánchez',
  'Pablo García',
  'Javier López',
  'Lucía Fernández',
  'Marta Gómez',
  'Andrés Torres',
  'Elena Navarro',
  'Sergio Díaz',
  'Nuria Castro',
  'Iván Moreno',
  'Paula Romero',
  'Hugo Vidal',
  'Sara Ortega',
  'Diego Blanco',
  'Ana Serrano',
  'Rubén Prieto',
  'Clara Molina',
  'Adrián Gil',
  'Laura Herrera',
  'Marcos Cano',
  'Irene Pardo',
  'Álvaro Nieto',
  'Rocío Vega',
];

/** Marcadores de partida distintos, para que cada pista arranque en otro momento. */
const START_POINTS: [Point, Point][] = [
  [0, 0],
  [15, 0],
  [30, 15],
  [40, 30],
  [15, 40],
  [40, 40],
];

const START_GAMES: [number, number][][] = [
  [[0, 0]],
  [[2, 1]],
  [[6, 4], [3, 2]],
  [[5, 5]],
  [[6, 3], [1, 4]],
  [[6, 4], [4, 6], [2, 2]],
];

const START_SETS: [number, number][] = [
  [0, 0],
  [0, 0],
  [1, 0],
  [0, 0],
  [1, 1],
  [1, 1],
];

/** Nombre único para la pista `index` (0-based). */
function courtName(index: number): string {
  return COURT_NAMES[index] ?? `Pista ${index + 1}`;
}

/** Selecciona el jugador `i` de la cantera, cíclicamente y con sufijo si repite. */
function playerName(i: number): string {
  const base = PLAYER_NAMES[i % PLAYER_NAMES.length];
  const cycle = Math.floor(i / PLAYER_NAMES.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}

/**
 * Genera `n` pistas mock con datos diferenciados (ids y nombres únicos, parejas
 * distintas y marcadores en distinto punto del partido).
 *
 * Sirve como semilla reutilizable: cada `Court` puede pasarse a un
 * `MockDataSource` (ver `createMockDataSources`) para simular su partido de
 * forma independiente.
 *
 * @param n Número de pistas a generar (>= 0).
 */
export function createMockCourts(n: number): Court[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`createMockCourts: n debe ser un entero >= 0, recibido ${n}`);
  }

  return Array.from({ length: n }, (_, index) => {
    const base = index * 4;
    return {
      id: index + 1,
      name: courtName(index),
      match: {
        teams: [
          {
            players: [
              { name: playerName(base) },
              { name: playerName(base + 1) },
            ],
          },
          {
            players: [
              { name: playerName(base + 2) },
              { name: playerName(base + 3) },
            ],
          },
        ],
        score: {
          currentPoint: [...START_POINTS[index % START_POINTS.length]] as [Point, Point],
          games: START_GAMES[index % START_GAMES.length].map(
            (set) => [...set] as [number, number],
          ),
          sets: [...START_SETS[index % START_SETS.length]] as [number, number],
        },
      },
    } satisfies Court;
  });
}
