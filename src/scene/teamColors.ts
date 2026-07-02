import * as THREE from 'three'

/**
 * Par de colores de una pista: uno por equipo (índice 0 y 1, coherente con
 * `match.teams`). El primer color corresponde al equipo local (mitad Z<0) y el
 * segundo al visitante (mitad Z>0), igual que hace `CourtView`.
 */
export type TeamColorPair = readonly [
  THREE.ColorRepresentation,
  THREE.ColorRepresentation,
]

/**
 * Paleta de colores de equipo disponibles, todos saturados y bien
 * diferenciables entre sí para distinguir parejas de un vistazo. El orden
 * importa: `assignTeamColors` los reparte de dos en dos, así que colores
 * consecutivos acaban en la misma pista (p. ej. azul + naranja en la primera).
 *
 * Con N pistas se necesitan 2·N colores para que ninguno se repita entre
 * pistas; esta paleta cubre hasta 6 pistas sin repeticiones.
 */
export const TEAM_PALETTE: readonly THREE.ColorRepresentation[] = [
  0x2f6bff, // azul
  0xff6a2f, // naranja
  0x2ecc71, // verde
  0x9b59ff, // morado
  0xe74c3c, // rojo
  0x1abc9c, // turquesa
  0xf1c40f, // amarillo
  0xff5fa2, // rosa
  0x00b8d4, // cian
  0x7c4dff, // índigo
  0x8bc34a, // lima
  0xff8f00, // ámbar
]

/**
 * Reparte un par de colores a cada una de las `count` pistas tomando colores
 * consecutivos de `palette`, de modo que **ningún color se repite entre pistas
 * distintas** (requisito de la visualización).
 *
 * Si no hay suficientes colores para todas las pistas (`2·count > palette`),
 * se reutiliza la paleta de forma cíclica como último recurso —lo que sí
 * repetiría colores— por lo que conviene mantener la paleta lo bastante grande
 * para el número de pistas mostradas.
 *
 * @param count   Número de pistas a colorear.
 * @param palette Paleta de colores a repartir. Por defecto `TEAM_PALETTE`.
 * @returns Un `TeamColorPair` por pista, en el mismo orden.
 */
export function assignTeamColors(
  count: number,
  palette: readonly THREE.ColorRepresentation[] = TEAM_PALETTE,
): TeamColorPair[] {
  const pairs: TeamColorPair[] = []
  for (let i = 0; i < count; i++) {
    const a = palette[(2 * i) % palette.length]
    const b = palette[(2 * i + 1) % palette.length]
    pairs.push([a, b])
  }
  return pairs
}
