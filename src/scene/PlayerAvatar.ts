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
  group.position.set(0, 1.18, 0.46)
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
