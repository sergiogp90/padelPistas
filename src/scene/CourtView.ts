import * as THREE from 'three'
import { PadelCourt } from './PadelCourt'
import { PlayerAvatar } from './PlayerAvatar'
import { createCamera, frameCourt } from './createCamera'
import { mountScoreboard } from '../ui/Scoreboard'
import type { DataSource } from '../data/DataSource'

/**
 * Color de cada equipo, indexado por equipo (0 y 1). Coherente con el orden que
 * usa el marcador (`teams[0]` vs `teams[1]`): el primer equipo es azul y el
 * segundo, naranja. Se exporta para poder reutilizarlo en otras vistas si el
 * marcador quiere colorear sus filas igual que los avatares de la pista.
 */
export const TEAM_COLORS: readonly [THREE.ColorRepresentation, THREE.ColorRepresentation] =
  [0x2f6bff, 0xff6a2f]

/**
 * Posición base de un jugador dentro de la pista (metros, relativas al centro).
 * Sistema de coordenadas de la pista (ver `PadelCourt`): largo 20 m en Z (±10),
 * ancho 10 m en X (±5) y red en Z=0.
 */
interface PlayerSlot {
  /** Desplazamiento lateral respecto al centro (m). */
  x: number
  /** Profundidad respecto a la red (m); el signo indica la mitad de la pista. */
  z: number
  /** Equipo al que pertenece (índice en `TEAM_COLORS` y en `match.teams`). */
  team: 0 | 1
}

/**
 * Colocación representativa de los 4 jugadores: 2 por equipo, repartidos a cada
 * lado de la red (equipo 0 en Z<0, equipo 1 en Z>0) y separados en X para cubrir
 * las dos mitades laterales de su campo. No pretende reproducir una táctica
 * concreta, solo poblar la pista de forma verosímil.
 */
const PLAYER_SLOTS: readonly PlayerSlot[] = [
  { x: -2.5, z: -5, team: 0 },
  { x: 2.5, z: -5, team: 0 },
  { x: -2.5, z: 5, team: 1 },
  { x: 2.5, z: 5, team: 1 },
]

// Vista autocontenida de UNA pista: su escena 3D (pista + luces), su cámara y su
// marcador overlay.
//
// Para renderizar N pistas usamos un único `WebGLRenderer` que dibuja cada vista
// en su propia celda de la pantalla (ver `MultiCourtRenderer`). Como cada celda
// se pinta por separado con `setViewport`/`setScissor`, cada `CourtView` posee
// su propia escena, cámara y luces: así una pista es independiente de las demás
// y el contenedor (`main.ts`) solo tiene que orquestar la rejilla, no compartir
// estado 3D entre pistas.

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
 * Encapsula una pista completa y autocontenida: su escena 3D (`scene`, con la
 * pista y las luces), su `camera` de retransmisión y su marcador (`scoreboardEl`,
 * listo para insertar en el DOM), todo vinculado al mismo `DataSource`. Un
 * renderer multipista dibuja cada `CourtView` en su celda con su propia cámara.
 */
export class CourtView {
  /** Escena propia de esta pista (pista, luces y fondo). Se renderiza sola. */
  readonly scene: THREE.Scene
  /** Cámara de retransmisión propia. Reencuádrala con `frame(aspect)`. */
  readonly camera: THREE.PerspectiveCamera
  /** Sub-árbol 3D de esta pista, colocado según la celda. Ya añadido a `scene`. */
  readonly object3D: THREE.Group
  /** Pista 3D contenida (útil para inspección/tests). */
  readonly court: PadelCourt
  /** Los 4 avatares de jugadores (2 por equipo), ya colocados en la pista. */
  readonly players: PlayerAvatar[]
  /** Overlay HTML del marcador. Insértalo en el DOM (p. ej. `document.body`). */
  readonly scoreboardEl: HTMLElement

  private readonly stopScoreboard: () => void

  constructor(source: DataSource, cell: CourtCell = {}) {
    this.court = new PadelCourt()

    this.object3D = new THREE.Group()
    this.object3D.add(this.court)
    this.object3D.position.set(cell.x ?? 0, 0, cell.z ?? 0)

    // 4 jugadores en posiciones representativas, con el color de su equipo.
    // Se añaden al sub-árbol de la pista para que se muevan con la celda.
    this.players = PLAYER_SLOTS.map((slot) => {
      const avatar = new PlayerAvatar(TEAM_COLORS[slot.team])
      avatar.position.set(slot.x, 0, slot.z)
      // El avatar mira hacia +Z por defecto; el equipo de la mitad lejana (Z>0)
      // gira 180° para encarar la red y quedar frente a sus rivales.
      if (slot.z > 0) avatar.rotation.y = Math.PI
      this.object3D.add(avatar)
      return avatar
    })

    // Escena propia de la celda: el fondo de cielo, la pista y sus luces. No se
    // comparte con las demás pistas, de modo que cada celda es independiente.
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.add(this.object3D)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 20, 10)
    this.scene.add(directionalLight)

    // Cámara con un aspecto provisional (1:1); el renderer la reencuadra con el
    // aspecto real de su celda vía `frame()` al maquetar la rejilla.
    this.camera = createCamera(1)

    const scoreboard = mountScoreboard(source)
    this.scoreboardEl = scoreboard.el
    this.stopScoreboard = scoreboard.stop
  }

  /**
   * Reencuadra la cámara para el aspecto (ancho/alto) de la celda donde se
   * dibuja esta pista. Llamar al maquetar la rejilla y al redimensionar.
   */
  frame(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    frameCourt(this.camera)
  }

  /** Cancela la suscripción del marcador. Llamar al retirar la vista. */
  dispose(): void {
    this.stopScoreboard()
  }
}
