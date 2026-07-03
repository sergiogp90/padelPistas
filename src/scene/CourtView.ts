import * as THREE from 'three'
import { PadelCourt } from './PadelCourt'
import { PlayerAvatar } from './PlayerAvatar'
import { PadelBall } from './PadelBall'
import { createCamera, frameCourt } from './createCamera'
import { mountScoreboard } from '../ui/Scoreboard'
import { TEAM_PALETTE, type TeamColorPair } from './teamColors'
import { getSkyGradientTexture } from './skyGradient'
import { createContactShadow, CONTACT_SHADOW_BASE_OPACITY } from './ContactShadow'
import type { DataSource } from '../data/DataSource'

/**
 * Par de colores por defecto de una pista, indexado por equipo (0 y 1) y
 * coherente con el orden que usa el marcador (`teams[0]` vs `teams[1]`): el
 * primer equipo es azul y el segundo, naranja. Es el primer par de
 * `TEAM_PALETTE`; se usa cuando no se indica `CourtViewOptions.teamColors`.
 *
 * Para mostrar varias pistas con colores distintos (sin repetir entre pistas)
 * usa `assignTeamColors` y pásale a cada `CourtView` su par por opciones.
 */
export const TEAM_COLORS: TeamColorPair = [TEAM_PALETTE[0], TEAM_PALETTE[1]]

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
 * Profundidades representativas (|z|, en metros) de un jugador dentro de su
 * mitad de pista, medidas desde la red (Z=0):
 *  - `NET_Z`: pareja subida a la red.
 *  - `BACK_Z`: pareja retrasada, por detrás de la línea de servicio (a 6,95 m de
 *    la red) en la zona de resto, cerca del cristal de fondo (a 10 m) pero sin
 *    pegarse a él.
 */
const NET_Z = 2.5
const BACK_Z = 8

/** Posiciones laterales (X) de los dos jugadores de un mismo equipo (m). */
const LATERAL_X: readonly [number, number] = [-2.5, 2.5]

/**
 * Profundidades (|z|) de los dos jugadores de cada equipo en un escenario. El
 * equipo 0 juega en la mitad Z<0 y el equipo 1 en la mitad Z>0; aquí se indican
 * como magnitudes y el signo lo aplica el constructor según el equipo.
 */
interface ScenarioSpec {
  /** Profundidades de los dos jugadores del equipo 0 (mitad Z<0). */
  team0: readonly [number, number]
  /** Profundidades de los dos jugadores del equipo 1 (mitad Z>0). */
  team1: readonly [number, number]
}

/**
 * Los 4 escenarios posibles de colocación de las dos parejas. Uno se elige al
 * azar al crear la pista (o se fija con `CourtViewOptions.scenario` en tests).
 * No reproducen una táctica exacta, solo poblar la pista de forma verosímil:
 *
 *  0. Equipo 0 en la red; equipo 1 retrasado tras la línea de servicio (resto).
 *  1. A la inversa: equipo 0 retrasado; equipo 1 en la red.
 *  2. Ambos equipos subidos a la red.
 *  3. Equipo 0 retrasado; equipo 1 escalonado (uno atrás para sacar y otro en la red).
 */
export const POSITION_SCENARIOS: readonly ScenarioSpec[] = [
  { team0: [NET_Z, NET_Z], team1: [BACK_Z, BACK_Z] },
  { team0: [BACK_Z, BACK_Z], team1: [NET_Z, NET_Z] },
  { team0: [NET_Z, NET_Z], team1: [NET_Z, NET_Z] },
  { team0: [BACK_Z, BACK_Z], team1: [BACK_Z, NET_Z] },
]

/** Traduce un `ScenarioSpec` a los 4 `PlayerSlot` concretos (con signo en Z). */
function slotsForScenario(spec: ScenarioSpec): PlayerSlot[] {
  const slots: PlayerSlot[] = []
  for (const team of [0, 1] as const) {
    const depths = team === 0 ? spec.team0 : spec.team1
    const sign = team === 0 ? -1 : 1
    depths.forEach((depth, i) => {
      slots.push({ x: LATERAL_X[i], z: sign * depth, team })
    })
  }
  return slots
}

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

/** Opciones de creación de una `CourtView`. */
export interface CourtViewOptions {
  /**
   * Índice del escenario de posiciones a usar (0-3, ver `POSITION_SCENARIOS`).
   * Si se omite, se elige uno al azar con `rng`. Útil para fijarlo en tests.
   */
  scenario?: number
  /** Fuente de aleatoriedad (inyectable para tests). Por defecto Math.random. */
  rng?: () => number
  /**
   * Par de colores de los dos equipos de esta pista (equipo 0 y equipo 1). Si
   * se omite, se usa `TEAM_COLORS` (azul/naranja). Para no repetir colores
   * entre pistas, genera los pares con `assignTeamColors` y asigna uno a cada
   * `CourtView`.
   */
  teamColors?: TeamColorPair
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
  /** Pelota que va y viene entre los jugadores de equipos contrarios. */
  readonly ball: PadelBall
  /** Sombras de contacto (falsas) bajo cada jugador, en el mismo orden. */
  readonly playerShadows: THREE.Mesh[]
  /** Sombra de contacto (falsa) bajo la pelota; se mueve con ella. */
  readonly ballShadow: THREE.Mesh
  /** Índice del escenario de posiciones aplicado (0-3, ver `POSITION_SCENARIOS`). */
  readonly scenario: number
  /** Par de colores de equipo aplicado a esta pista (equipo 0 y equipo 1). */
  readonly teamColors: TeamColorPair
  /** Overlay HTML del marcador. Insértalo en el DOM (p. ej. `document.body`). */
  readonly scoreboardEl: HTMLElement

  private readonly stopScoreboard: () => void

  constructor(source: DataSource, cell: CourtCell = {}, options: CourtViewOptions = {}) {
    this.court = new PadelCourt()

    this.object3D = new THREE.Group()
    this.object3D.add(this.court)
    this.object3D.position.set(cell.x ?? 0, 0, cell.z ?? 0)

    // Escenario de colocación: el indicado, o uno al azar entre los 4 posibles.
    const rng = options.rng ?? Math.random
    this.scenario =
      options.scenario ?? Math.floor(rng() * POSITION_SCENARIOS.length)

    // Colores de los dos equipos de esta pista: los indicados o azul/naranja.
    this.teamColors = options.teamColors ?? TEAM_COLORS

    // 4 jugadores según el escenario elegido, con el color de su equipo.
    // Se añaden al sub-árbol de la pista para que se muevan con la celda.
    const slots = slotsForScenario(POSITION_SCENARIOS[this.scenario])
    this.players = slots.map((slot) => {
      const avatar = new PlayerAvatar(this.teamColors[slot.team])
      avatar.position.set(slot.x, 0, slot.z)
      // El avatar mira hacia +Z por defecto; el equipo de la mitad lejana (Z>0)
      // gira 180° para encarar la red y quedar frente a sus rivales.
      if (slot.z > 0) avatar.rotation.y = Math.PI
      this.object3D.add(avatar)
      return avatar
    })

    // Pelota que pelotea sin fin entre jugadores de equipos contrarios. Comparte
    // el sub-árbol de la pista (mismas coordenadas que los jugadores) y su equipo
    // por jugador es el del slot correspondiente, en el mismo orden.
    const teams = slots.map((slot) => slot.team)
    this.ball = new PadelBall(this.players, teams, { rng })
    this.object3D.add(this.ball)

    // Sombras de contacto (falsas y baratas) para que jugadores y pelota no
    // parezcan flotar y ganar sensación de apoyo/profundidad sin el coste de
    // sombras reales. Una estática bajo cada jugador (su micro-movimiento en
    // reposo es pequeño) y una bajo la pelota que la sigue en cada fotograma.
    this.playerShadows = this.players.map((player) => {
      const shadow = createContactShadow(0.45)
      shadow.position.set(player.position.x, shadow.position.y, player.position.z)
      this.object3D.add(shadow)
      return shadow
    })
    this.ballShadow = createContactShadow(0.18)
    this.object3D.add(this.ballShadow)

    // Escena propia de la celda: el fondo de cielo, la pista y sus luces. No se
    // comparte con las demás pistas, de modo que cada celda es independiente.
    this.scene = new THREE.Scene()
    // Fondo en degradado (cielo → horizonte) en vez de un color plano, y una
    // niebla muy sutil del color del horizonte para dar profundidad atmosférica
    // a los elementos lejanos sin apagar la pista.
    this.scene.background = getSkyGradientTexture()
    this.scene.fog = new THREE.Fog(0xbfe0f2, 40, 150)
    this.scene.add(this.object3D)

    // Iluminación con volumen (sin aplanar):
    //  - Hemisférica: luz de cielo claro por arriba y rebote verdoso del suelo
    //    por abajo, que da gradiente de tono al modelado (ambiente con volumen).
    //  - Clave direccional cálida en picado desde un lateral: crea el relieve.
    //  - Relleno frío tenue desde el lado opuesto: suaviza las sombras propias
    //    para que ninguna cara quede completamente negra.
    // Las intensidades están calibradas para el `tone mapping` ACESFilmic del
    // renderer (ver `MultiCourtRenderer`), que de otro modo oscurecería la escena.
    const hemisphere = new THREE.HemisphereLight(0xbfe0f2, 0x3a5f2a, 1.1)
    this.scene.add(hemisphere)
    const keyLight = new THREE.DirectionalLight(0xfff2e0, 2.4)
    keyLight.position.set(8, 16, 10)
    this.scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0xdfe9ff, 0.5)
    fillLight.position.set(-10, 8, -6)
    this.scene.add(fillLight)

    // Cámara con un aspecto provisional (1:1); el renderer la reencuadra con el
    // aspecto real de su celda vía `frame()` al maquetar la rejilla.
    this.camera = createCamera(1)

    // Marcador overlay coherente con los colores 3D de esta pista: se convierten
    // los colores de equipo a strings CSS (`#rrggbb`) para el overlay HTML.
    const scoreboardColors: [string, string] = [
      new THREE.Color(this.teamColors[0]).getStyle(),
      new THREE.Color(this.teamColors[1]).getStyle(),
    ]
    const scoreboard = mountScoreboard(source, { teamColors: scoreboardColors })
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

  /**
   * Avanza la animación de la pista un fotograma: aplica a cada jugador su
   * micro-movimiento en reposo (ver `PlayerAvatar.update`) y mueve la pelota por
   * su peloteo (ver `PadelBall.update`). Ligado al `delta` de tiempo, por lo que
   * es independiente de los FPS.
   *
   * @param delta Segundos transcurridos desde el fotograma anterior.
   */
  update(delta: number): void {
    for (const player of this.players) player.update(delta)
    // La pelota se actualiza tras los jugadores para leer sus posiciones ya
    // avanzadas en este fotograma.
    this.ball.update(delta)
    this.updateBallShadow()
  }

  /**
   * Sitúa la sombra de la pelota bajo su proyección en el suelo y la modula
   * según la altura: cuanto más alta vuela la pelota, mayor y más difusa (menos
   * opaca) es su sombra, imitando cómo se abre y desvanece una sombra real al
   * alejarse el objeto del suelo.
   */
  private updateBallShadow(): void {
    const { x, y, z } = this.ball.position
    this.ballShadow.position.set(x, this.ballShadow.position.y, z)
    // k: 0 a ras de suelo → 1 a ~3 m de altura (tope de los arcos de peloteo).
    const k = THREE.MathUtils.clamp(y / 3, 0, 1)
    this.ballShadow.scale.setScalar(1 + k * 1.5)
    const material = this.ballShadow.material as THREE.MeshBasicMaterial
    material.opacity = CONTACT_SHADOW_BASE_OPACITY * (1 - k * 0.7)
  }

  /** Cancela la suscripción del marcador. Llamar al retirar la vista. */
  dispose(): void {
    this.stopScoreboard()
  }
}
