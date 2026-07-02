import * as THREE from 'three'
import { PadelCourt } from './PadelCourt'
import { mountScoreboard } from '../ui/Scoreboard'
import type { DataSource } from '../data/DataSource'

// Vista reutilizable de UNA pista: su sub-árbol 3D y su marcador overlay.
//
// `main.ts` montaba a mano la única pista (court + marcador). Para renderizar N
// pistas (hito M3) ese montaje se encapsula aquí: dado un `DataSource` y una
// celda, `CourtView` construye la pista 3D colocada en su posición y el marcador
// alimentado por la fuente. La escena, la cámara y las luces globales siguen
// siendo responsabilidad del contenedor (`main.ts`), porque se comparten entre
// todas las pistas.

/**
 * Celda/región donde se coloca una pista dentro de la escena, como
 * desplazamiento en el plano del suelo (metros). Es agnóstica al layout: quien
 * disponga la rejilla (hito M3) calcula la posición de cada pista; para una sola
 * pista basta con la celda por defecto (origen), que reproduce la vista actual.
 */
export interface CourtCell {
  /** Desplazamiento en el eje X (metros). Por defecto 0. */
  x?: number
  /** Desplazamiento en el eje Z (metros). Por defecto 0. */
  z?: number
}

/**
 * Encapsula el montaje de una pista: la pista 3D (`object3D`, lista para añadir
 * a una escena) y su marcador (`scoreboardEl`, listo para insertar en el DOM),
 * ambos vinculados al mismo `DataSource`.
 */
export class CourtView {
  /** Sub-árbol 3D de esta pista, colocado según la celda. Añádelo a la escena. */
  readonly object3D: THREE.Group
  /** Pista 3D contenida (útil para inspección/tests). */
  readonly court: PadelCourt
  /** Overlay HTML del marcador. Insértalo en el DOM (p. ej. `document.body`). */
  readonly scoreboardEl: HTMLElement

  private readonly stopScoreboard: () => void

  constructor(source: DataSource, cell: CourtCell = {}) {
    this.court = new PadelCourt()

    this.object3D = new THREE.Group()
    this.object3D.add(this.court)
    this.object3D.position.set(cell.x ?? 0, 0, cell.z ?? 0)

    const scoreboard = mountScoreboard(source)
    this.scoreboardEl = scoreboard.el
    this.stopScoreboard = scoreboard.stop
  }

  /** Cancela la suscripción del marcador. Llamar al retirar la vista. */
  dispose(): void {
    this.stopScoreboard()
  }
}
