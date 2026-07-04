import type { Point, Score } from '../types';

// Lógica pura de progresión del marcador de pádel: dado un `Score` y el equipo
// que gana el punto, calcula el `Score` resultante (punto → juego → set).
//
// Todas las funciones son puras: devuelven un nuevo `Score` sin mutar el de
// entrada, de modo que `MockDataSource` (u otra fuente) pueda reemplazar el
// estado y notificar a los suscriptores con tranquilidad.

/** Índice de un equipo dentro de las tuplas del marcador (0 ó 1). */
export type TeamIndex = 0 | 1;

// Secuencia de puntos hasta el "40"; la ventaja se gestiona aparte.
const POINT_SEQUENCE: Point[] = [0, 15, 30, 40];

// Mejor de 3 sets: el partido acaba cuando un equipo gana 2.
const SETS_TO_WIN_MATCH = 2;

/** Siguiente punto en la escalera 0 → 15 → 30 → 40. */
function nextPoint(point: Point): Point {
  const index = POINT_SEQUENCE.indexOf(point);
  return POINT_SEQUENCE[index + 1];
}

/** ¿Ha terminado el partido? (un equipo ha ganado los sets necesarios). */
export function isMatchOver(score: Score): boolean {
  return score.sets[0] >= SETS_TO_WIN_MATCH || score.sets[1] >= SETS_TO_WIN_MATCH;
}

/**
 * Equipo al saque, derivado del propio marcador: en pádel (como en tenis) el
 * saque alterna en cada juego, así que el equipo que saca lo determina la
 * paridad del número total de juegos ya disputados. Asumimos que el equipo 0
 * sirvió el primer juego del partido.
 *
 * Al derivarlo del marcador no hace falta almacenarlo en el modelo y el
 * indicador se mantiene siempre coherente con el resultado (cambia solo cuando
 * se cierra un juego). No modela el tie-break, suficiente para el overlay.
 */
export function servingTeam(score: Score): TeamIndex {
  const gamesPlayed = score.games.reduce((total, [a, b]) => total + a + b, 0);
  return (gamesPlayed % 2) as TeamIndex;
}

/** ¿Se gana el set con estos juegos? 6 con +2 de margen, o 7 (tras 6-6). */
function isSetWon(winnerGames: number, loserGames: number): boolean {
  return (winnerGames >= 6 && winnerGames - loserGames >= 2) || winnerGames === 7;
}

/**
 * Avanza el marcador asignando un punto al equipo `winner`.
 *
 * Gestiona la transición punto → juego → set, incluyendo el "deuce" (40-40 →
 * Ventaja → juego, o vuelta a 40-40). Si el partido ya estaba terminado,
 * devuelve el mismo marcador sin cambios.
 */
export function advanceScore(score: Score, winner: TeamIndex): Score {
  if (isMatchOver(score)) return score;

  const loser: TeamIndex = winner === 0 ? 1 : 0;
  const winnerPoint = score.currentPoint[winner];
  const loserPoint = score.currentPoint[loser];

  const nextCurrentPoint: [Point, Point] = [...score.currentPoint];
  let gameWon = false;

  if (winnerPoint === 'Ventaja') {
    // Ventaja confirmada → se gana el juego.
    gameWon = true;
  } else if (winnerPoint === 40) {
    if (loserPoint === 40) {
      // Deuce → el ganador pasa a Ventaja.
      nextCurrentPoint[winner] = 'Ventaja';
    } else if (loserPoint === 'Ventaja') {
      // El rival tenía Ventaja → se vuelve a deuce (40-40).
      nextCurrentPoint[winner] = 40;
      nextCurrentPoint[loser] = 40;
    } else {
      // 40 contra 0/15/30 → se gana el juego.
      gameWon = true;
    }
  } else {
    // 0/15/30 → siguiente punto.
    nextCurrentPoint[winner] = nextPoint(winnerPoint);
  }

  if (!gameWon) {
    return { ...score, currentPoint: nextCurrentPoint };
  }

  return winGame(score, winner, loser);
}

/** Suma un juego al equipo `winner` y resuelve el cierre de set si procede. */
function winGame(score: Score, winner: TeamIndex, loser: TeamIndex): Score {
  const games = score.games.map((set) => [...set] as [number, number]);
  const currentSet = games[games.length - 1];
  currentSet[winner] += 1;

  const sets: [number, number] = [...score.sets];

  if (isSetWon(currentSet[winner], currentSet[loser])) {
    sets[winner] += 1;
    // Abrir un nuevo set salvo que el partido haya terminado.
    if (sets[0] < SETS_TO_WIN_MATCH && sets[1] < SETS_TO_WIN_MATCH) {
      games.push([0, 0]);
    }
  }

  return { currentPoint: [0, 0], games, sets };
}
