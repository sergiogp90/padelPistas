import * as THREE from 'three'

/**
 * Pelota de pádel que va y viene entre los 4 jugadores de la pista, imitando un
 * peloteo continuo. En cada golpe la pelota sale del jugador que la tenía y vuela
 * describiendo un arco (parábola) hasta un jugador **del equipo contrario**,
 * elegido al azar. Nunca pasa entre compañeros de un mismo equipo (esa es la
 * única restricción del peloteo): como el destino siempre está en el bando rival,
 * el poseedor alterna de equipo en cada golpe.
 *
 * Diseño de la pelota (ver imagen de referencia del issue): esfera de color
 * verde-amarillo (como una pelota de tenis/pádel) con una **costura** blanca
 * ondulada que la recorre, modelada como un tubo fino que sigue una curva sobre
 * la superficie de la esfera.
 *
 * La pelota es un `THREE.Group` que se coloca en el mismo sub-árbol que los
 * jugadores (coordenadas de la pista, metros), de modo que comparte su sistema de
 * referencia. La animación depende solo del tiempo acumulado (delta), así que es
 * independiente de los FPS, igual que el micro-movimiento de los avatares.
 */

// --- Geometría de la pelota (metros) -----------------------------------------
// Radio algo mayor que el real (~0,033 m) para que se distinga en la pantalla
// junto a jugadores de ~1,74 m y una pista de 20×10 m.
const BALL_RADIUS = 0.06
const BALL_SEGMENTS = 16
// Color verde-amarillo de pelota de pádel/tenis.
const BALL_COLOR = 0xd4e84a
// Costura blanca: tubo fino que recorre la superficie.
const SEAM_COLOR = 0xf5f5f5
const SEAM_RADIUS = 0.006
// Amplitud de la ondulación de la costura (rad de latitud). Da el aspecto de la
// costura curva de una pelota de tenis en vez de un simple ecuador.
const SEAM_WOBBLE = 0.6

// --- Peloteo (rally) ---------------------------------------------------------
// Altura (m) del punto de golpeo en los extremos del vuelo (a la altura de la
// pala/cintura de un jugador). La parábola sube por encima de esta altura.
const HIT_HEIGHT = 0.85
// Duración de cada golpe (s), elegida al azar en este rango para que el ritmo no
// sea monótono.
const MIN_FLIGHT = 0.7
const MAX_FLIGHT = 1.4
// Altura del arco (m) sobre la línea recta entre origen y destino. Proporcional
// a la distancia del golpe, con un mínimo para que los golpes cortos también
// tengan un arco visible.
const MIN_ARC = 1.0
const ARC_RATIO = 0.18
// Velocidad de giro de la pelota en vuelo (rad/s) para dar sensación de efecto.
const SPIN_SPEED = 8

/**
 * Elige al azar el índice de un jugador del **equipo contrario** al del
 * poseedor. Nunca devuelve un compañero: solo se consideran los jugadores cuyo
 * equipo difiere del de `holderIndex`. Función pura (con `rng` inyectable) para
 * poder comprobar la restricción en tests.
 *
 * @param teams Equipo (0 o 1) de cada jugador, en el mismo orden que `players`.
 * @param holderIndex Índice del jugador que tiene ahora la pelota.
 * @param rng Fuente de aleatoriedad en [0, 1).
 * @returns Índice de un rival elegido al azar.
 */
export function pickOpponent(
  teams: readonly (0 | 1)[],
  holderIndex: number,
  rng: () => number,
): number {
  const opponents: number[] = []
  for (let i = 0; i < teams.length; i++) {
    if (teams[i] !== teams[holderIndex]) opponents.push(i)
  }
  return opponents[Math.floor(rng() * opponents.length)]
}

/**
 * Posición de la pelota en un instante del vuelo: interpolación lineal entre
 * `from` y `to` más una parábola vertical `arcHeight·4·p·(1−p)` que vale 0 en los
 * extremos (p=0 y p=1) y alcanza `arcHeight` en el punto medio (p=0.5). Escribe
 * el resultado en `out` y lo devuelve. Función pura, comprobable en tests.
 *
 * @param p Progreso del vuelo en [0, 1].
 */
export function arcPosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  arcHeight: number,
  p: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.lerpVectors(from, to, p)
  out.y += arcHeight * 4 * p * (1 - p)
  return out
}

/** Objeto mínimo que la pelota necesita de un jugador: su posición en la pista. */
interface BallPlayer {
  readonly position: THREE.Vector3
}

/** Opciones de creación de la pelota. */
export interface PadelBallOptions {
  /** Fuente de aleatoriedad (inyectable para tests). Por defecto `Math.random`. */
  rng?: () => number
}

export class PadelBall extends THREE.Group {
  private readonly players: readonly BallPlayer[]
  private readonly teams: readonly (0 | 1)[]
  private readonly rng: () => number

  /** Índice del jugador desde el que sale el golpe actual. */
  private holderIndex: number
  /** Índice del jugador rival al que se dirige el golpe actual. */
  private targetIndex = 0
  private readonly from = new THREE.Vector3()
  private readonly to = new THREE.Vector3()
  private duration = MIN_FLIGHT
  private arcHeight = MIN_ARC
  private elapsed = 0

  /**
   * @param players Los 4 avatares de la pista (posiciones vivas en la pista).
   * @param teams Equipo (0 o 1) de cada jugador, en el mismo orden que `players`.
   */
  constructor(
    players: readonly BallPlayer[],
    teams: readonly (0 | 1)[],
    options: PadelBallOptions = {},
  ) {
    super()
    this.players = players
    this.teams = teams
    this.rng = options.rng ?? Math.random

    this.add(buildBall())

    // Empieza en manos de un jugador al azar y lanza el primer golpe hacia un
    // rival. La posición inicial es su punto de golpeo, para que el primer arco
    // salga de ahí.
    this.holderIndex = Math.floor(this.rng() * players.length)
    const holder = players[this.holderIndex].position
    this.position.set(holder.x, HIT_HEIGHT, holder.z)
    this.beginFlight()
  }

  /**
   * Prepara un nuevo golpe: fija el origen en la posición actual de la pelota,
   * elige un rival al azar como destino (nunca un compañero) y calcula la
   * duración y la altura del arco de este vuelo.
   */
  private beginFlight(): void {
    this.from.copy(this.position)
    this.targetIndex = pickOpponent(this.teams, this.holderIndex, this.rng)
    const target = this.players[this.targetIndex].position
    this.to.set(target.x, HIT_HEIGHT, target.z)

    const dist = this.from.distanceTo(this.to)
    this.arcHeight = Math.max(MIN_ARC, dist * ARC_RATIO)
    this.duration = MIN_FLIGHT + this.rng() * (MAX_FLIGHT - MIN_FLIGHT)
    this.elapsed = 0
  }

  /**
   * Avanza el peloteo un fotograma. Mueve la pelota por su arco actual y, al
   * llegar al destino, el rival golpeado pasa a ser el nuevo poseedor y se lanza
   * el siguiente golpe hacia el otro equipo. Además hace girar la pelota para
   * simular el efecto.
   *
   * @param delta Segundos transcurridos desde el fotograma anterior.
   */
  update(delta: number): void {
    this.elapsed += delta
    const p = this.duration > 0 ? this.elapsed / this.duration : 1

    if (p >= 1) {
      // Llegada: el rival golpeado se convierte en el nuevo poseedor y devuelve
      // la pelota hacia el equipo contrario.
      this.position.copy(this.to)
      this.holderIndex = this.targetIndex
      this.beginFlight()
    } else {
      arcPosition(this.from, this.to, this.arcHeight, p, this.position)
    }

    this.rotation.x += SPIN_SPEED * delta
    this.rotation.y += SPIN_SPEED * 0.5 * delta
  }
}

// --- Construcción de la malla ------------------------------------------------

/** Construye la esfera verde-amarilla con su costura blanca ondulada. */
function buildBall(): THREE.Group {
  const group = new THREE.Group()

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, BALL_SEGMENTS, BALL_SEGMENTS),
    new THREE.MeshStandardMaterial({ color: BALL_COLOR, roughness: 0.9 }),
  )
  group.add(sphere)

  // Costura: tubo fino que recorre una curva ondulada sobre la superficie,
  // ligeramente por fuera del radio para que no quede oculta por la esfera.
  const seamCurve = new BallSeamCurve(BALL_RADIUS + SEAM_RADIUS * 0.5, SEAM_WOBBLE)
  const seam = new THREE.Mesh(
    new THREE.TubeGeometry(seamCurve, 96, SEAM_RADIUS, 8, true),
    new THREE.MeshStandardMaterial({ color: SEAM_COLOR, roughness: 0.7 }),
  )
  group.add(seam)

  return group
}

/**
 * Curva cerrada sobre una esfera cuya latitud oscila con `sin(2·θ)` mientras el
 * azimut da una vuelta completa: sube y baja dos veces respecto al ecuador,
 * dibujando la costura curva característica de una pelota de tenis/pádel.
 */
class BallSeamCurve extends THREE.Curve<THREE.Vector3> {
  private readonly radius: number
  private readonly wobble: number

  constructor(radius: number, wobble: number) {
    super()
    this.radius = radius
    this.wobble = wobble
  }

  getPoint(u: number, target = new THREE.Vector3()): THREE.Vector3 {
    const azimuth = u * Math.PI * 2
    const polar = Math.PI / 2 + this.wobble * Math.sin(2 * azimuth)
    const sinP = Math.sin(polar)
    return target.set(
      this.radius * sinP * Math.cos(azimuth),
      this.radius * Math.cos(polar),
      this.radius * sinP * Math.sin(azimuth),
    )
  }
}
