import type { Point, Score } from '../types';

/**
 * Lógica de progresión del marcador de pádel.
 *
 * Todas las funciones de este módulo son **puras**: no mutan sus argumentos ni
 * dependen de la UI o del temporizador. Reciben un `Score` y devuelven uno
 * nuevo, lo que permite simular partidos o validar datos reales de forma
 * predecible y fácil de testear.
 */

/** Equipo que disputa el punto: `0` = pareja local, `1` = pareja visitante. */
export type TeamIndex = 0 | 1;

/**
 * Sets necesarios para ganar el partido. Se juega al mejor de 3 sets, así que
 * el primer equipo que gana 2 sets cierra el partido.
 */
export const SETS_PARA_GANAR = 2;

/** Avance ordenado de los puntos "normales" de un juego (sin la ventaja). */
const SECUENCIA_PUNTOS: readonly Point[] = [0, 15, 30, 40];

/** Devuelve el índice del equipo rival. */
function rivalDe(equipo: TeamIndex): TeamIndex {
  return equipo === 0 ? 1 : 0;
}

/** Indica si algún equipo ya ha ganado los sets suficientes para cerrar el partido. */
export function hayGanadorDePartido(sets: [number, number]): boolean {
  return sets[0] >= SETS_PARA_GANAR || sets[1] >= SETS_PARA_GANAR;
}

/**
 * Regla de cierre de SET aplicada en este proyecto:
 *
 * - Se gana el set al llegar a **6 juegos con una diferencia de 2** (6-0 … 6-4).
 * - Si se llega a **5-5**, el set continúa hasta el **7-5**.
 * - Si se llega a **6-6**, en lugar de modelar un tie-break (que no cabe en el
 *   tipo `Point`), aplicamos un **juego decisivo**: el primero en alcanzar 7
 *   juegos gana el set (**7-6**).
 *
 * En resumen: gana el set quien tenga al menos 6 juegos con ventaja de 2, o bien
 * quien alcance 7 juegos.
 *
 * @param propios   Juegos del equipo que acaba de sumar.
 * @param delRival  Juegos del equipo rival en el set en curso.
 */
function ganaSet(propios: number, delRival: number): boolean {
  return (propios >= 6 && propios - delRival >= 2) || propios === 7;
}

/**
 * Cierra el juego en favor de `equipo`: suma el juego al set en curso, reinicia
 * el punto a 0-0 y, si procede, cierra el set (y abre el siguiente si el partido
 * continúa). Devuelve un `Score` nuevo.
 */
function cerrarJuego(score: Score, equipo: TeamIndex): Score {
  const rival = rivalDe(equipo);

  // Copia profunda de los juegos para no mutar el `Score` de entrada.
  const games: [number, number][] = score.games.map(
    (set) => [set[0], set[1]] as [number, number],
  );

  const indiceSetActual = games.length - 1;
  const setActual = games[indiceSetActual];
  setActual[equipo] += 1;

  const sets: [number, number] = [score.sets[0], score.sets[1]];

  // ¿Este juego cierra el set en curso?
  if (ganaSet(setActual[equipo], setActual[rival])) {
    sets[equipo] += 1;

    // Si el partido sigue vivo, abrimos un nuevo set vacío (0-0 juegos).
    if (!hayGanadorDePartido(sets)) {
      games.push([0, 0]);
    }
  }

  // Tras un juego (o set) el punto siempre vuelve a 0-0.
  return { currentPoint: [0, 0], games, sets };
}

/**
 * Avance del punto actual cuando el juego **no** se cierra: 0 → 15 → 30 → 40.
 * Solo se invoca con puntos que tienen un sucesor en la secuencia.
 */
function siguientePunto(punto: Point): Point {
  const indice = SECUENCIA_PUNTOS.indexOf(punto);
  return SECUENCIA_PUNTOS[indice + 1];
}

/**
 * Aplica el punto ganado por `equipo` y devuelve el `Score` resultante.
 *
 * Función **pura**: no modifica el `score` recibido. Aplica las reglas de pádel:
 *
 * - Avance del punto: `0 → 15 → 30 → 40 → (Ventaja) → juego`.
 * - Deuce/iguales (40-40): el ganador del punto pasa a `Ventaja`.
 * - Con `Ventaja` a favor: ese equipo gana el juego.
 * - Con `Ventaja` en contra: el punto vuelve a 40-40 (deuce).
 * - Cierre de juego → set → partido según las reglas documentadas arriba.
 *
 * Si el partido ya está cerrado, devuelve el mismo `score` sin cambios.
 *
 * @param score   Marcador actual.
 * @param equipo  Equipo que gana el punto (`0` local, `1` visitante).
 */
export function ganarPunto(score: Score, equipo: TeamIndex): Score {
  // El partido ya tiene ganador: no se altera el marcador.
  if (hayGanadorDePartido(score.sets)) {
    return score;
  }

  const rival = rivalDe(equipo);
  const puntoPropio = score.currentPoint[equipo];
  const puntoRival = score.currentPoint[rival];

  // Con ventaja a favor, este punto cierra el juego.
  if (puntoPropio === 'Ventaja') {
    return cerrarJuego(score, equipo);
  }

  if (puntoPropio === 40) {
    // 40-40 (deuce): el ganador del punto se anota la ventaja.
    if (puntoRival === 40) {
      const currentPoint: [Point, Point] = [score.currentPoint[0], score.currentPoint[1]];
      currentPoint[equipo] = 'Ventaja';
      return { currentPoint, games: score.games, sets: score.sets };
    }

    // El rival tenía ventaja: se pierde y el punto vuelve a 40-40.
    if (puntoRival === 'Ventaja') {
      const currentPoint: [Point, Point] = [40, 40];
      return { currentPoint, games: score.games, sets: score.sets };
    }

    // El rival va por debajo de 40: este punto cierra el juego.
    return cerrarJuego(score, equipo);
  }

  // Puntos normales (0/15/30): simplemente se avanza en la secuencia.
  const currentPoint: [Point, Point] = [score.currentPoint[0], score.currentPoint[1]];
  currentPoint[equipo] = siguientePunto(puntoPropio);
  return { currentPoint, games: score.games, sets: score.sets };
}
