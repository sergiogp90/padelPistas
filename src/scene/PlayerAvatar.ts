import * as THREE from 'three'

/**
 * Avatar de jugador estilizado (low-poly).
 *
 * Figura humana simple y reutilizable pensada para poblar la pista sin recurrir
 * a modelos realistas (ver decisión de arquitectura «avatares estilizados»).
 * Se construye con primitivas de Three.js (cápsulas, esferas, cilindros y
 * cajas) manteniendo un recuento de polígonos bajo.
 *
 * Anatomía representada:
 *  - Cuerpo (cápsula) con el **color de equipo** en su material.
 *  - Cabeza (esfera) con **rostro** (ojos) y **pelo**.
 *  - **Brazos** y **manos** que sujetan una **pala de pádel** con ambas manos.
 *  - **Piernas** con las rodillas ligeramente flexionadas (posición de resto).
 *  - **Gorra** opcional, determinada aleatoriamente al crear el avatar.
 *
 * La pala recibe un color generado aleatoriamente en cada avatar. Tanto el
 * color de la pala como la presencia de gorra pueden fijarse por opciones (o
 * inyectando un `rng` determinista) para poder comprobarlos en tests.
 *
 * Escala humana coherente con la pista en metros: ~1,75 m de alto, con los
 * pies apoyados en y = 0.
 *
 * No depende del DOM: es instanciable y comprobable de forma estructural.
 */

// --- Escala general (metros) -------------------------------------------------
const AVATAR_HEIGHT = 1.74 // coronilla (sin gorra)

// Cadera: punto donde las piernas se unen al torso.
const HIP_Y = 0.85

// Cuerpo: cápsula (cilindro rematado por dos semiesferas).
const BODY_RADIUS = 0.17
const BODY_TOTAL_H = 0.64
const BODY_CENTER_Y = HIP_Y + BODY_TOTAL_H / 2 // 1.17 → torso de 0.85 a 1.49
const CYLINDER_LENGTH = BODY_TOTAL_H - 2 * BODY_RADIUS // 0.30

// Cabeza: esfera apoyada sobre el cuerpo; su coronilla marca AVATAR_HEIGHT.
const HEAD_RADIUS = 0.14
const HEAD_CENTER_Y = AVATAR_HEIGHT - HEAD_RADIUS // 1.60

// Segmentos bajos para conservar el estilo low-poly.
const BODY_SEGMENTS = 8
const HEAD_SEGMENTS = 12
const LIMB_SEGMENTS = 6

// --- Colores -----------------------------------------------------------------
const SKIN_COLOR = 0xf1c9a5 // cabeza y manos
const HAIR_COLOR = 0x2e1c10
const EYE_COLOR = 0x1a1a1a
const SHORTS_COLOR = 0x33373f // muslos
const SOCK_COLOR = 0xf5f5f5 // espinillas
const SHOE_COLOR = 0xdedede // pies
const HANDLE_COLOR = 0x222222 // mango de la pala

// --- Micro-movimiento en reposo (idle) ---------------------------------------
// Cada avatar se mueve alrededor de su posición base para dar sensación de
// actividad sin simular el juego real. El desplazamiento combina un vaivén en
// el plano del suelo (X/Z) con un rebote vertical (Y) que simula un pequeño
// trote. La desincronización entre jugadores se consigue con amplitudes,
// frecuencias y fases distintas generadas con el `rng` de cada avatar.

// Amplitud total (m) del vaivén horizontal, repartida entre los ejes X y Z.
// Como |offset| ≤ ampX + ampZ = amplitud total, ningún jugador se aleja más de
// este radio (`idleRadius`) de su base.
const IDLE_MIN_AMPLITUDE = 0.18
const IDLE_MAX_AMPLITUDE = 0.42
// Frecuencias angulares (rad/s) → ritmo del vaivén horizontal. Más altas que el
// micro-movimiento original para que el desplazamiento se perciba con claridad.
const IDLE_MIN_FREQ = 1.4
const IDLE_MAX_FREQ = 2.8

// Rebote vertical (trote): el cuerpo sube y baja rítmicamente. Se modela con
// |sin(...)|, que oscila entre 0 y la amplitud, de modo que el offset en Y es
// siempre ≥ 0 y los pies nunca bajan de su posición base (no atraviesan el
// suelo). La frecuencia es más alta que la del vaivén → cadencia de trote.
const IDLE_BOB_MIN_AMPLITUDE = 0.05
const IDLE_BOB_MAX_AMPLITUDE = 0.11
const IDLE_BOB_MIN_FREQ = 4.5
const IDLE_BOB_MAX_FREQ = 7.5

export interface PlayerAvatarOptions {
  /** Color de la pala. Si se omite, se genera aleatoriamente. */
  racketColor?: THREE.ColorRepresentation
  /** Si lleva gorra. Si se omite, se decide aleatoriamente. */
  hasCap?: boolean
  /** Fuente de aleatoriedad (inyectable para tests). Por defecto Math.random. */
  rng?: () => number
}

export class PlayerAvatar extends THREE.Group {
  /** Malla del cuerpo, cuyo material lleva el color del equipo. */
  readonly body: THREE.Mesh
  /** Malla de la cabeza. */
  readonly head: THREE.Mesh
  /** Grupo con muslos, espinillas y pies (piernas flexionadas). */
  readonly legs: THREE.Group
  /** Grupo con brazos y manos. */
  readonly arms: THREE.Group
  /** Las dos manos que agarran la pala. */
  readonly hands: THREE.Mesh[]
  /** Grupo con la pala de pádel (mango + cabeza). */
  readonly racket: THREE.Group
  /** Color aplicado a la cabeza de la pala. */
  readonly racketColor: THREE.Color
  /** Ojos del rostro. */
  readonly eyes: THREE.Mesh[]
  /** Pelo (casquete). */
  readonly hair: THREE.Mesh
  /** Si el avatar lleva gorra. */
  readonly hasCap: boolean
  /** Malla de la gorra, o `null` si no lleva. */
  readonly cap: THREE.Mesh | null

  /**
   * Posición alrededor de la cual oscila el avatar. Se captura de forma
   * perezosa la primera vez que se llama a `update()`, para respetar la
   * posición que le asigne quien lo coloque en la pista tras construirlo.
   */
  readonly basePosition = new THREE.Vector3()
  private baseCaptured = false
  private idleTime = 0
  // Parámetros del vaivén en reposo (amplitud/frecuencia/fase por eje).
  private readonly idle: {
    ampX: number
    ampZ: number
    freqX: number
    freqZ: number
    phaseX: number
    phaseZ: number
    bobAmp: number
    bobFreq: number
    bobPhase: number
  }

  constructor(
    teamColor: THREE.ColorRepresentation = 0xffffff,
    options: PlayerAvatarOptions = {},
  ) {
    super()

    const rng = options.rng ?? Math.random

    // Color de pala: el indicado, o uno aleatorio y vívido (HSL).
    this.racketColor =
      options.racketColor !== undefined
        ? new THREE.Color(options.racketColor)
        : new THREE.Color().setHSL(rng(), 0.7, 0.5)

    // Gorra: la indicada, o decidida al azar.
    this.hasCap = options.hasCap ?? rng() < 0.5

    // Parámetros del micro-movimiento en reposo. La amplitud total se reparte
    // entre X y Z, y frecuencias/fases se generan al azar para que cada jugador
    // se mueva con su propio ritmo (desincronizado respecto de los demás).
    const lerp = (min: number, max: number) => min + rng() * (max - min)
    const amplitude = lerp(IDLE_MIN_AMPLITUDE, IDLE_MAX_AMPLITUDE)
    const split = lerp(0.35, 0.65) // reparto X/Z (evita ejes degenerados)
    this.idle = {
      ampX: amplitude * split,
      ampZ: amplitude * (1 - split),
      freqX: lerp(IDLE_MIN_FREQ, IDLE_MAX_FREQ),
      freqZ: lerp(IDLE_MIN_FREQ, IDLE_MAX_FREQ),
      phaseX: rng() * Math.PI * 2,
      phaseZ: rng() * Math.PI * 2,
      bobAmp: lerp(IDLE_BOB_MIN_AMPLITUDE, IDLE_BOB_MAX_AMPLITUDE),
      bobFreq: lerp(IDLE_BOB_MIN_FREQ, IDLE_BOB_MAX_FREQ),
      bobPhase: rng() * Math.PI * 2,
    }

    // Cuerpo y cabeza.
    this.body = buildBody(teamColor)
    this.head = buildHead()

    // Rostro y pelo (hijos de la cabeza para moverse con ella).
    this.eyes = buildEyes()
    this.hair = buildHair()
    this.eyes.forEach((eye) => this.head.add(eye))
    this.head.add(this.hair)

    // Gorra opcional (también hija de la cabeza).
    if (this.hasCap) {
      this.cap = buildCap(teamColor)
      this.head.add(this.cap)
    } else {
      this.cap = null
    }

    // Extremidades y pala.
    this.legs = buildLegs()
    const armsBuild = buildArms()
    this.arms = armsBuild.group
    this.hands = armsBuild.hands
    this.racket = buildRacket(this.racketColor)

    this.add(this.legs)
    this.add(this.body)
    this.add(this.arms)
    this.add(this.head)
    this.add(this.racket)
  }

  /** Cambia el color de equipo aplicado al material del cuerpo. */
  setTeamColor(teamColor: THREE.ColorRepresentation): void {
    ;(this.body.material as THREE.MeshStandardMaterial).color.set(teamColor)
  }

  /**
   * Radio máximo (m) del vaivén horizontal en reposo. Como el desplazamiento es
   * `ampX·sin(...)` en X y `ampZ·sin(...)` en Z, su distancia a la base en el
   * plano del suelo nunca supera `ampX + ampZ`. No incluye el rebote vertical.
   */
  get idleRadius(): number {
    return this.idle.ampX + this.idle.ampZ
  }

  /**
   * Avanza el movimiento en reposo del avatar un fotograma. Combina un vaivén en
   * el plano del suelo (X/Z), dentro del radio `idleRadius` alrededor de su
   * posición base —la que tenía la primera vez que se llamó—, con un rebote
   * vertical (Y) que simula un pequeño trote. El offset en Y es siempre ≥ 0, de
   * modo que los pies nunca bajan de su posición base.
   *
   * El desplazamiento depende solo del tiempo acumulado, no del número de pasos:
   * aplicar el mismo `delta` total en uno o en muchos fotogramas produce la
   * misma posición, de modo que la animación es independiente de los FPS.
   *
   * @param delta Segundos transcurridos desde el fotograma anterior.
   */
  update(delta: number): void {
    if (!this.baseCaptured) {
      this.basePosition.copy(this.position)
      this.baseCaptured = true
    }
    this.idleTime += delta
    const { ampX, ampZ, freqX, freqZ, phaseX, phaseZ, bobAmp, bobFreq, bobPhase } = this.idle
    this.position.x = this.basePosition.x + ampX * Math.sin(freqX * this.idleTime + phaseX)
    this.position.z = this.basePosition.z + ampZ * Math.sin(freqZ * this.idleTime + phaseZ)
    // Rebote de trote: |sin| ∈ [0, 1] → el cuerpo sube y baja sin hundir los pies.
    this.position.y = this.basePosition.y + bobAmp * Math.abs(Math.sin(bobFreq * this.idleTime + bobPhase))
  }
}

// --- Construcción de partes --------------------------------------------------

function buildBody(teamColor: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(
    BODY_RADIUS,
    CYLINDER_LENGTH,
    BODY_SEGMENTS / 2,
    BODY_SEGMENTS,
  )
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = BODY_CENTER_Y
  return mesh
}

function buildHead(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(HEAD_RADIUS, HEAD_SEGMENTS, HEAD_SEGMENTS)
  const mat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = HEAD_CENTER_Y
  return mesh
}

function buildEyes(): THREE.Mesh[] {
  // Posiciones relativas al centro de la cabeza (mira hacia +Z).
  const mat = new THREE.MeshStandardMaterial({ color: EYE_COLOR })
  const geo = new THREE.SphereGeometry(0.022, 8, 8)
  return [-0.05, 0.05].map((x) => {
    const eye = new THREE.Mesh(geo, mat)
    eye.position.set(x, 0.02, HEAD_RADIUS - 0.01)
    return eye
  })
}

function buildHair(): THREE.Mesh {
  // Casquete: media esfera algo mayor que la cabeza cubriendo la parte alta.
  const geo = new THREE.SphereGeometry(
    HEAD_RADIUS + 0.008,
    HEAD_SEGMENTS,
    HEAD_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.55,
  )
  const mat = new THREE.MeshStandardMaterial({ color: HAIR_COLOR })
  const hair = new THREE.Mesh(geo, mat)
  // Ligeramente retrasado para dejar el rostro despejado.
  hair.position.set(0, 0, -0.01)
  return hair
}

function buildCap(teamColor: THREE.ColorRepresentation): THREE.Mesh {
  // Copa: media esfera sobre la coronilla (hija de la cabeza).
  const domeGeo = new THREE.SphereGeometry(
    HEAD_RADIUS + 0.015,
    HEAD_SEGMENTS,
    HEAD_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.5,
  )
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })
  const dome = new THREE.Mesh(domeGeo, mat)

  // Visera: caja aplanada hacia el frente.
  const visorGeo = new THREE.BoxGeometry(0.22, 0.02, 0.12)
  const visor = new THREE.Mesh(visorGeo, mat)
  visor.position.set(0, 0.005, HEAD_RADIUS - 0.01)
  dome.add(visor)

  return dome
}

function buildLegs(): THREE.Group {
  const group = new THREE.Group()
  const shortsMat = new THREE.MeshStandardMaterial({ color: SHORTS_COLOR })
  const sockMat = new THREE.MeshStandardMaterial({ color: SOCK_COLOR })
  const shoeMat = new THREE.MeshStandardMaterial({ color: SHOE_COLOR })

  // Una pierna por lado. Rodillas adelantadas (z+) → flexión de resto.
  for (const side of [-1, 1]) {
    const x = 0.11 * side
    const hip = new THREE.Vector3(x, HIP_Y, 0)
    const knee = new THREE.Vector3(x, 0.48, 0.12) // rodilla flexionada hacia delante
    const ankle = new THREE.Vector3(x, 0.09, 0.0)

    group.add(cylinderBetween(hip, knee, 0.09, shortsMat)) // muslo
    group.add(cylinderBetween(knee, ankle, 0.07, sockMat)) // espinilla

    // Pie: caja apoyada en el suelo, adelantada.
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.24),
      shoeMat,
    )
    foot.position.set(x, 0.03, 0.06)
    group.add(foot)
  }

  return group
}

function buildArms(): { group: THREE.Group; hands: THREE.Mesh[] } {
  const group = new THREE.Group()
  const hands: THREE.Mesh[] = []
  const armMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const handGeo = new THREE.SphereGeometry(0.06, LIMB_SEGMENTS, LIMB_SEGMENTS)

  // Ambos brazos se estiran al frente para sujetar el mango con las dos manos,
  // con la pala apuntando hacia delante (posición de resto/espera).
  const config = [
    {
      shoulder: new THREE.Vector3(-0.19, 1.44, 0),
      elbow: new THREE.Vector3(-0.16, 1.32, 0.26),
      hand: new THREE.Vector3(-0.05, 1.22, 0.5),
    },
    {
      shoulder: new THREE.Vector3(0.19, 1.44, 0),
      elbow: new THREE.Vector3(0.16, 1.32, 0.26),
      hand: new THREE.Vector3(0.06, 1.22, 0.5),
    },
  ]

  for (const { shoulder, elbow, hand } of config) {
    group.add(cylinderBetween(shoulder, elbow, 0.06, armMat)) // brazo
    group.add(cylinderBetween(elbow, hand, 0.05, armMat)) // antebrazo

    const handMesh = new THREE.Mesh(handGeo, armMat)
    handMesh.position.copy(hand)
    group.add(handMesh)
    hands.push(handMesh)
  }

  return { group, hands }
}

function buildRacket(color: THREE.Color): THREE.Group {
  const group = new THREE.Group()
  const handleMat = new THREE.MeshStandardMaterial({ color: HANDLE_COLOR })
  const headMat = new THREE.MeshStandardMaterial({ color })

  // Construida en local apuntando hacia +Y; luego se orienta e inserta en las manos.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.16, LIMB_SEGMENTS),
    handleMat,
  )
  handle.position.y = 0.08
  group.add(handle)

  // Cuello (unión mango-cabeza).
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.06, LIMB_SEGMENTS),
    headMat,
  )
  throat.position.y = 0.19
  group.add(throat)

  // Cabeza redondeada de la pala: esfera aplanada (disco ovalado).
  const headGeo = new THREE.SphereGeometry(0.15, HEAD_SEGMENTS, HEAD_SEGMENTS)
  const racketHead = new THREE.Mesh(headGeo, headMat)
  racketHead.scale.set(0.85, 1.0, 0.22)
  racketHead.position.y = 0.34
  group.add(racketHead)

  // Se agarra entre las manos y se estira hacia DELANTE (casi horizontal, con
  // una ligera inclinación hacia arriba), como en la posición de resto/espera.
  // Construida apuntando a +Y, se lleva a +Z girando ~+90° en el eje X.
  //
  // Además se gira 90° sobre su propio eje longitudinal (rotation.y, aplicado
  // antes que rotation.x con el orden Euler 'XYZ') para poner la cara de la pala
  // VERTICAL de canto: la cara (normal local +Z) queda apuntando al lateral (±X)
  // y el canto lateral perpendicular al eje X, como una pala en posición de
  // espera vista desde el lado (ver foto de referencia), en vez de tumbada.
  group.position.set(0, 1.18, 0.46)
  group.rotation.y = Math.PI / 2
  group.rotation.x = Math.PI / 2 - 0.28

  return group
}

/**
 * Crea un cilindro (radio constante) que va del punto `a` al `b`, orientándolo
 * a lo largo del segmento. Útil para modelar extremidades articuladas.
 */
function cylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a)
  const length = dir.length()
  const geo = new THREE.CylinderGeometry(radius, radius, length, LIMB_SEGMENTS)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5) // punto medio
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize(),
  )
  return mesh
}
