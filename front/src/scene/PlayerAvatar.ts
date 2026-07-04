import * as THREE from 'three'
import type { PlayerGender } from '../types'

/**
 * Avatar de jugador estilizado (low-poly).
 *
 * Figura humana simple y reutilizable pensada para poblar la pista sin recurrir
 * a modelos realistas (ver decisión de arquitectura «avatares estilizados»). Se
 * construye por completo con primitivas de Three.js y geometría procedural
 * (cápsulas, esferas, cilindros, cajas y formas 2D), manteniendo un recuento de
 * polígonos bajo para poder mostrar decenas de avatares en la rejilla multipista.
 *
 * Anatomía representada:
 *  - **Torso** (cápsula) con el **color de equipo**, rematado por unos
 *    **hombros** anchos y un **cuello** que lo unen con la cabeza para suavizar
 *    la silueta (menos aspecto de «piezas sueltas»).
 *  - **Cabeza** (esfera) con **rostro** (ojos, nariz y boca) y **pelo**, que
 *    depende del **género**: los hombres llevan pelo corto (o van calvos, con
 *    menor probabilidad) y las mujeres, melena larga.
 *  - **Brazos** y **manos** que sujetan una **pala de pádel** con ambas manos.
 *    Las manos insinúan **dedos** agarrando el mango (ya no son esferas lisas).
 *  - **Piernas** con las rodillas ligeramente flexionadas (posición de resto).
 *    Los muslos y espinillas van en **color piel** (se visten con prenda corta),
 *    con **calcetín** y **zapatilla** en el pie. Una **pelvis** enlaza el torso
 *    con ambos muslos (la cadera) y hay **esferas de articulación** en cadera,
 *    rodilla y tobillo que redondean las uniones.
 *  - **Prenda inferior** según el género: **calzonas cortas** en los hombres
 *    (dejan ver el color carne de muslo y espinilla) o **falda deportiva**
 *    acampanada en las mujeres.
 *  - **Pecho** con curvas (dos volúmenes suaves con el color de equipo) solo en
 *    las mujeres.
 *  - **Gorra** opcional, determinada aleatoriamente al crear el avatar.
 *
 * **Jerarquía por articulaciones (pensada para un rig futuro):** brazos y
 * piernas se organizan en grupos anidados hombro→codo→mano y cadera→rodilla→pie,
 * de modo que cada articulación es un `THREE.Group` propio. Hoy solo se
 * construyen en pose estática, pero la estructura permitiría animarlas más
 * adelante sin rehacer la geometría.
 *
 * **Pala:** cara **redonda y con grosor** (disco extruido, `ExtrudeGeometry`,
 * con el canto biselado para que se note el volumen), un **puente triangular**
 * hacia el mango y un **grip** oscuro diferenciado. Los **agujeros** de la cara
 * se resuelven con una **textura de transparencia** (`alphaMap` procedural),
 * **no** con geometría perforada, para no disparar el recuento de triángulos con
 * 36 avatares en pantalla.
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
const BODY_TOP_Y = HIP_Y + BODY_TOTAL_H // 1.49 → hombros/cuello

// Cabeza: esfera apoyada sobre el cuerpo; su coronilla marca AVATAR_HEIGHT.
const HEAD_RADIUS = 0.14
const HEAD_CENTER_Y = AVATAR_HEIGHT - HEAD_RADIUS // 1.60

// Segmentos bajos para conservar el estilo low-poly.
const BODY_SEGMENTS = 8
const HEAD_SEGMENTS = 12
const LIMB_SEGMENTS = 6

// --- Colores -----------------------------------------------------------------
const SKIN_COLOR = 0xf1c9a5 // cabeza, manos y piernas (se ven al vestir corto)
const HAIR_COLOR = 0x2e1c10
const EYE_COLOR = 0x1a1a1a
const MOUTH_COLOR = 0x8a4b3c
const SHORTS_COLOR = 0x33373f // calzonas (hombre)
const SOCK_COLOR = 0xf5f5f5 // calcetín (tobillo)
const SHOE_COLOR = 0xdedede // pies
const HANDLE_COLOR = 0x1b1b1b // grip (puño) de la pala, oscuro

// --- Género y variantes ------------------------------------------------------
// El género del jugador vive en `types` (es un dato de dominio); aquí se
// reexporta por comodidad, ya que selecciona el diseño del avatar.
export type { PlayerGender }

// Probabilidad de que un hombre sea calvo. Menor que la de tener pelo, tal como
// pide el diseño («menor % de ser calvo»).
const BALD_PROBABILITY = 0.2

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
  /**
   * Género del jugador, que decide el diseño (pelo, ropa y silueta). Si se
   * omite, se elige al azar. Pensado para alimentarse en el futuro desde el
   * datasource, donde cada jugador indicará su género.
   */
  gender?: PlayerGender
  /**
   * Fuerza que un hombre sea (o no) calvo. Solo aplica a `gender: 'male'`; se
   * ignora en mujeres (siempre con pelo largo). Si se omite, se decide al azar
   * con probabilidad {@link BALD_PROBABILITY}.
   */
  isBald?: boolean
  /** Fuente de aleatoriedad (inyectable para tests). Por defecto Math.random. */
  rng?: () => number
}

export class PlayerAvatar extends THREE.Group {
  /** Malla del cuerpo, cuyo material lleva el color del equipo. */
  readonly body: THREE.Mesh
  /** Hombros anchos que rematan el torso (color de equipo). */
  readonly shoulders: THREE.Mesh
  /** Cuello que une el torso con la cabeza. */
  readonly neck: THREE.Mesh
  /** Malla de la cabeza. */
  readonly head: THREE.Mesh
  /** Grupo con las dos piernas (jerarquía cadera→rodilla→pie por lado). */
  readonly legs: THREE.Group
  /** Grupo con los dos brazos (jerarquía hombro→codo→mano por lado). */
  readonly arms: THREE.Group
  /** Las dos manos (palmas) que agarran la pala. */
  readonly hands: THREE.Mesh[]
  /** Grupo con la pala de pádel (mango + puente + cara con agujeros). */
  readonly racket: THREE.Group
  /** Cara redonda y con grosor de la pala (con `alphaMap` de agujeros). */
  readonly racketFace: THREE.Mesh
  /** Color aplicado a la cara de la pala. */
  readonly racketColor: THREE.Color
  /** Ojos del rostro. */
  readonly eyes: THREE.Mesh[]
  /** Nariz del rostro. */
  readonly nose: THREE.Mesh
  /** Boca del rostro. */
  readonly mouth: THREE.Mesh
  /**
   * Pelo del avatar. En los hombres con pelo es un casquete (`THREE.Mesh`); en
   * las mujeres, un grupo con casquete + melena (`THREE.Group`); en los hombres
   * calvos es `null`.
   */
  readonly hair: THREE.Object3D | null
  /** Género del avatar (decide el diseño de pelo, ropa y silueta). */
  readonly gender: PlayerGender
  /** Si el avatar es calvo (solo posible en hombres). */
  readonly isBald: boolean
  /**
   * Prenda inferior: calzonas cortas (hombre) o falda deportiva (mujer). La
   * falda va en color de equipo; las calzonas, en su color propio.
   */
  readonly lowerGarment: THREE.Mesh
  /** Curvas del pecho (color de equipo), o `null` en los hombres. */
  readonly chest: THREE.Group | null
  /** Si el avatar lleva gorra. */
  readonly hasCap: boolean
  /** Grupo de la gorra (copa + visera), o `null` si no lleva. */
  readonly cap: THREE.Group | null

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

    // Género: el indicado o uno al azar (50/50). En el futuro llegará del
    // datasource; hoy se reparte al azar para poblar la pista con ambos.
    this.gender = options.gender ?? (rng() < 0.5 ? 'male' : 'female')

    // Calvicie: solo posible en hombres y con probabilidad reducida.
    this.isBald =
      this.gender === 'male' && (options.isBald ?? rng() < BALD_PROBABILITY)

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

    // Torso, hombros y cuello (color de equipo en torso y hombros).
    this.body = buildBody(teamColor)
    this.shoulders = buildShoulders(teamColor)
    this.neck = buildNeck()
    this.head = buildHead()

    // Rostro y pelo (hijos de la cabeza para moverse con ella). El pelo depende
    // del género (corto/calvo en hombres, melena en mujeres).
    this.eyes = buildEyes()
    this.nose = buildNose()
    this.mouth = buildMouth()
    this.hair = buildHair(this.gender, this.isBald)
    this.eyes.forEach((eye) => this.head.add(eye))
    this.head.add(this.nose)
    this.head.add(this.mouth)
    if (this.hair) this.head.add(this.hair)

    // Gorra opcional (también hija de la cabeza).
    if (this.hasCap) {
      this.cap = buildCap(teamColor)
      this.head.add(this.cap)
    } else {
      this.cap = null
    }

    // Prenda inferior según el género: calzonas cortas (hombre) o falda
    // deportiva (mujer). Se coloca sobre la pelvis, dejando las piernas de piel
    // a la vista por debajo.
    this.lowerGarment =
      this.gender === 'male' ? buildShorts() : buildSkirt(teamColor)

    // Curvas del pecho, solo en las mujeres (color de equipo, como el torso).
    this.chest = this.gender === 'female' ? buildChest(teamColor) : null

    // Extremidades (jerarquía articulada) y pala.
    this.legs = buildLegs()
    const armsBuild = buildArms()
    this.arms = armsBuild.group
    this.hands = armsBuild.hands
    const racketBuild = buildRacket(this.racketColor)
    this.racket = racketBuild.group
    this.racketFace = racketBuild.face

    this.add(this.legs)
    this.add(this.lowerGarment)
    this.add(this.body)
    this.add(this.shoulders)
    this.add(this.neck)
    if (this.chest) this.add(this.chest)
    this.add(this.arms)
    this.add(this.head)
    this.add(this.racket)
  }

  /**
   * Cambia el color de equipo aplicado a las prendas: torso, hombros y —en las
   * mujeres— el pecho y la falda deportiva (las calzonas de los hombres llevan
   * color propio y no se ven afectadas).
   */
  setTeamColor(teamColor: THREE.ColorRepresentation): void {
    ;(this.body.material as THREE.MeshStandardMaterial).color.set(teamColor)
    ;(this.shoulders.material as THREE.MeshStandardMaterial).color.set(teamColor)
    if (this.gender === 'female') {
      ;(this.lowerGarment.material as THREE.MeshStandardMaterial).color.set(teamColor)
      this.chest?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          ;(obj.material as THREE.MeshStandardMaterial).color.set(teamColor)
        }
      })
    }
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
  // Cintura algo más estrecha que el pecho: aplana ligeramente la parte baja
  // del torso para insinuar la silueta (más forma, menos «tubo»).
  mesh.scale.set(1.0, 1.0, 0.85)
  return mesh
}

function buildShoulders(teamColor: THREE.ColorRepresentation): THREE.Mesh {
  // Cápsula horizontal sobre el torso: ensancha los hombros y suaviza la unión
  // con los brazos (menos aspecto de cilindros sueltos).
  const geo = new THREE.CapsuleGeometry(0.1, 0.24, BODY_SEGMENTS / 2, BODY_SEGMENTS)
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.z = Math.PI / 2 // tumbada de hombro a hombro (eje X)
  mesh.scale.set(1.0, 1.0, 0.8)
  mesh.position.set(0, BODY_TOP_Y - 0.03, 0)
  return mesh
}

function buildNeck(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.06, 0.07, 0.1, LIMB_SEGMENTS)
  const mat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = BODY_TOP_Y + 0.02
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
    eye.position.set(x, 0.03, HEAD_RADIUS - 0.01)
    return eye
  })
}

function buildNose(): THREE.Mesh {
  // Pequeño cono saliente centrado bajo los ojos (color piel).
  const geo = new THREE.ConeGeometry(0.022, 0.05, LIMB_SEGMENTS)
  const mat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const nose = new THREE.Mesh(geo, mat)
  // Apunta hacia delante (+Z): girar el cono (eje +Y) 90° sobre X.
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, 0.0, HEAD_RADIUS + 0.005)
  return nose
}

function buildMouth(): THREE.Mesh {
  // Boca insinuada: caja fina y ancha bajo la nariz.
  const geo = new THREE.BoxGeometry(0.06, 0.015, 0.02)
  const mat = new THREE.MeshStandardMaterial({ color: MOUTH_COLOR })
  const mouth = new THREE.Mesh(geo, mat)
  mouth.position.set(0, -0.06, HEAD_RADIUS - 0.005)
  return mouth
}

/**
 * Pelo del avatar según el género:
 *  - **Hombre con pelo**: casquete corto (media esfera sobre la coronilla).
 *  - **Hombre calvo**: sin pelo (`null`); asoma la cabeza (color piel).
 *  - **Mujer**: melena larga = casquete + una masa que cae por detrás de la
 *    cabeza hasta la altura de los hombros/espalda.
 *
 * Devuelve un `THREE.Mesh` (pelo corto), un `THREE.Group` (melena) o `null`
 * (calvo).
 */
function buildHair(gender: PlayerGender, isBald: boolean): THREE.Object3D | null {
  if (isBald) return null

  const mat = new THREE.MeshStandardMaterial({ color: HAIR_COLOR })

  // Casquete: media esfera algo mayor que la cabeza cubriendo la parte alta.
  const capGeo = new THREE.SphereGeometry(
    HEAD_RADIUS + 0.008,
    HEAD_SEGMENTS,
    HEAD_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.55,
  )
  const cap = new THREE.Mesh(capGeo, mat)
  // Ligeramente retrasado para dejar el rostro despejado.
  cap.position.set(0, 0, -0.01)

  if (gender === 'male') return cap // pelo corto

  // Mujer: melena. Al casquete se le añade una masa alargada por detrás que cae
  // hasta la espalda. Es una cápsula vertical, aplanada contra la espalda (menor
  // grosor en Z) y desplazada hacia atrás para envolver la nuca sin tapar la cara.
  const group = new THREE.Group()
  group.add(cap)
  const maneGeo = new THREE.CapsuleGeometry(0.12, 0.26, BODY_SEGMENTS / 2, BODY_SEGMENTS)
  const mane = new THREE.Mesh(maneGeo, mat)
  mane.scale.set(1, 1, 0.55)
  mane.position.set(0, -0.16, -0.07)
  group.add(mane)
  return group
}

// Inclinación de la copa hacia atrás (rad). Un borde horizontal no puede quedar
// a la vez por encima de los ojos (delante) y por debajo del pelo (detrás), así
// que se inclina la copa: el borde delantero sube y el trasero baja.
const CAP_TILT = 0.6

function buildCap(teamColor: THREE.ColorRepresentation): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })

  // Copa: casquete esférico claramente mayor que la cabeza. El radio debe superar
  // el alcance del pelo (que va 0,01 hacia atrás, llegando a ~0,158 del centro),
  // o el pelo asomaría por fuera de la copa por detrás. Baja un poco por debajo
  // del ecuador (thetaLength > π/2) para tapar el pelo por los lados y, con la
  // inclinación hacia atrás, cae más por detrás cubriendo la nuca; el borde
  // delantero, en cambio, queda levantado por encima de los ojos.
  const domeGeo = new THREE.SphereGeometry(
    HEAD_RADIUS + 0.022,
    HEAD_SEGMENTS,
    HEAD_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.56,
  )
  // Se hornea la inclinación en la geometría (en vez de rotar la malla) para que
  // su caja envolvente siga siendo ajustada: al medir la altura del avatar con
  // `Box3.setFromObject`, una malla rotada sobreestimaría la caja (envuelve la
  // AABB local ya girada) y falsearía la altura.
  domeGeo.rotateX(-CAP_TILT) // inclina la copa hacia atrás
  const dome = new THREE.Mesh(domeGeo, mat)
  group.add(dome)

  // Visera: caja fina hacia delante, colocada a la altura de la frente (POR
  // ENCIMA de los ojos, que están en y≈+0.03 respecto del centro de la cabeza) y
  // horizontal, independiente de la inclinación de la copa. Sale del borde
  // delantero levantado de la copa.
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.13), mat)
  visor.position.set(0, 0.07, 0.15)
  group.add(visor)

  return group
}

/**
 * Piernas con jerarquía articulada por lado: un grupo `cadera` contiene el
 * muslo y un grupo `rodilla`, que a su vez contiene la espinilla y un grupo
 * `tobillo` con el pie. Así cada articulación es un `THREE.Group` propio,
 * preparado para un rig futuro. La pose es estática (rodillas flexionadas).
 *
 * Muslos y espinillas van en **color piel**: la ropa (calzonas o falda) es una
 * prenda corta aparte que cubre solo la cadera, de modo que ambas «piezas» de la
 * pierna quedan a la vista, como pide el diseño. El tobillo lleva un pequeño
 * **calcetín** y el pie una **zapatilla**.
 *
 * Para que la figura no parezca un ensamblado de cilindros sueltos, las uniones
 * se redondean con **esferas de articulación** en cadera, rodilla y tobillo, y
 * una **pelvis** (cápsula horizontal, como los hombros) enlaza el torso con
 * ambos muslos formando la cadera. Las esferas son algo mayores que los
 * segmentos que unen, de modo que tapan el escalón de radio entre muslo,
 * espinilla y pie.
 */
function buildLegs(): THREE.Group {
  const group = new THREE.Group()
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const sockMat = new THREE.MeshStandardMaterial({ color: SOCK_COLOR })
  const shoeMat = new THREE.MeshStandardMaterial({ color: SHOE_COLOR })
  const origin = new THREE.Vector3(0, 0, 0)

  // Pelvis/cadera: cápsula horizontal que une el torso con ambos muslos (mismo
  // recurso que los hombros arriba). Se solapa con la base del torso y con la
  // parte alta de los muslos, cerrando el hueco que quedaba entre las piernas.
  // Va en color piel porque la prenda (calzonas/falda) la cubre por fuera.
  const pelvis = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.14, BODY_SEGMENTS / 2, BODY_SEGMENTS),
    skinMat,
  )
  pelvis.rotation.z = Math.PI / 2 // tumbada de cadera a cadera (eje X)
  pelvis.scale.set(1, 1, 0.85)
  pelvis.position.set(0, HIP_Y + 0.02, 0)
  group.add(pelvis)

  for (const side of [-1, 1]) {
    const x = 0.11 * side
    // Puntos en el espacio del avatar (rodillas adelantadas → flexión de resto).
    const hipPos = new THREE.Vector3(x, HIP_Y, 0)
    const kneePos = new THREE.Vector3(x, 0.48, 0.12)
    const anklePos = new THREE.Vector3(x, 0.09, 0.0)

    const hip = new THREE.Group()
    hip.position.copy(hipPos)
    hip.add(jointSphere(0.1, skinMat)) // articulación de cadera (ball joint)
    hip.add(cylinderBetween(origin, kneePos.clone().sub(hipPos), 0.09, skinMat)) // muslo (piel)

    const knee = new THREE.Group()
    knee.position.copy(kneePos.clone().sub(hipPos))
    knee.add(jointSphere(0.08, skinMat)) // rodilla
    knee.add(cylinderBetween(origin, anklePos.clone().sub(kneePos), 0.07, skinMat)) // espinilla (piel)

    const ankle = new THREE.Group()
    ankle.position.copy(anklePos.clone().sub(kneePos))
    ankle.add(jointSphere(0.062, sockMat)) // tobillo con calcetín
    // Pie: caja apoyada en el suelo, adelantada respecto del tobillo.
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), shoeMat)
    foot.position.set(0, -0.06, 0.06)
    ankle.add(foot)

    knee.add(ankle)
    hip.add(knee)
    group.add(hip)
  }

  return group
}

/**
 * Calzonas cortas (hombres): tronco de cono abierto y ceñido que cubre la cadera
 * y el arranque de los muslos, dejando a la vista el color piel del resto de la
 * pierna (muslo y espinilla). Color propio, independiente del equipo.
 */
function buildShorts(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.19, 0.23, 0.22, BODY_SEGMENTS * 2, 1, true)
  const mat = new THREE.MeshStandardMaterial({
    color: SHORTS_COLOR,
    side: THREE.DoubleSide,
  })
  const shorts = new THREE.Mesh(geo, mat)
  // Centradas sobre la cadera: cubren de ~0,72 a ~0,94 m (parte alta del muslo).
  shorts.position.y = HIP_Y - 0.02
  return shorts
}

/**
 * Falda deportiva (mujeres): tronco de cono abierto y acampanado que cae desde
 * la cadera, más ancho y largo que las calzonas. Va en color de equipo (parte
 * del uniforme), por lo que `setTeamColor` la recolorea.
 */
function buildSkirt(teamColor: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.17, 0.31, 0.26, BODY_SEGMENTS * 2, 1, true)
  const mat = new THREE.MeshStandardMaterial({
    color: teamColor,
    side: THREE.DoubleSide,
  })
  const skirt = new THREE.Mesh(geo, mat)
  // Cae desde la cadera y se abre hacia abajo (vuelo).
  skirt.position.y = HIP_Y - 0.05
  return skirt
}

/**
 * Curvas del pecho (mujeres): dos volúmenes suaves (medias esferas ligeramente
 * aplanadas) sobre la parte alta del torso, en color de equipo (como la
 * camiseta). Se devuelven en un grupo para poder recolorearlos en bloque.
 */
function buildChest(teamColor: THREE.ColorRepresentation): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })
  const geo = new THREE.SphereGeometry(0.075, BODY_SEGMENTS, BODY_SEGMENTS)
  for (const side of [-1, 1]) {
    const bust = new THREE.Mesh(geo, mat)
    // Sobre la parte alta del torso, apenas sobresaliendo hacia delante (+Z).
    bust.position.set(0.07 * side, 1.28, 0.11)
    bust.scale.set(1, 0.9, 0.8)
    group.add(bust)
  }
  return group
}

/**
 * Brazos con jerarquía articulada por lado: un grupo `hombro` contiene el brazo
 * y un grupo `codo`, que a su vez contiene el antebrazo y un grupo `mano` con la
 * palma y los dedos. Cada articulación es un `THREE.Group` propio (rig futuro).
 * Ambos brazos se estiran al frente para sujetar el mango con las dos manos.
 */
function buildArms(): { group: THREE.Group; hands: THREE.Mesh[] } {
  const group = new THREE.Group()
  const hands: THREE.Mesh[] = []
  const armMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR })
  const origin = new THREE.Vector3(0, 0, 0)

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

  for (const { shoulder: sPos, elbow: ePos, hand: hPos } of config) {
    const shoulder = new THREE.Group()
    shoulder.position.copy(sPos)
    shoulder.add(cylinderBetween(origin, ePos.clone().sub(sPos), 0.06, armMat)) // brazo

    const elbow = new THREE.Group()
    elbow.position.copy(ePos.clone().sub(sPos))
    elbow.add(cylinderBetween(origin, hPos.clone().sub(ePos), 0.05, armMat)) // antebrazo

    const handGroup = new THREE.Group()
    handGroup.position.copy(hPos.clone().sub(ePos))
    const { group: hand, palm } = buildHand(armMat)
    handGroup.add(hand)

    elbow.add(handGroup)
    shoulder.add(elbow)
    group.add(shoulder)
    hands.push(palm)
  }

  return { group, hands }
}

/**
 * Mano estilizada que insinúa un agarre: una palma (caja redondeada) con varios
 * dedos (pequeños cilindros curvados) cerrándose sobre el mango, en lugar de una
 * esfera lisa. Devuelve el grupo y la malla de la palma (referencia pública).
 */
function buildHand(mat: THREE.Material): { group: THREE.Group; palm: THREE.Mesh } {
  const group = new THREE.Group()

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.055), mat)
  group.add(palm)

  // Cuatro dedos: cilindros cortos que envuelven el mango por delante (+Z).
  const fingerGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.06, LIMB_SEGMENTS)
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeo, mat)
    // Repartidos a lo alto de la palma, doblados hacia delante (agarre).
    finger.position.set(0, 0.03 - i * 0.022, 0.035)
    finger.rotation.x = Math.PI / 2
    group.add(finger)
  }

  // Pulgar: cilindro cruzado por el otro lado del mango.
  const thumb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, LIMB_SEGMENTS),
    mat,
  )
  thumb.position.set(0, -0.01, -0.03)
  thumb.rotation.z = Math.PI / 2
  group.add(thumb)

  return { group, palm }
}

/**
 * Pala de pádel estilizada. Devuelve el grupo (mango + puente + cara) y la
 * malla de la cara, cuyo material usa un `alphaMap` procedural para los
 * agujeros (sin geometría perforada).
 *
 * Se construye en local con el eje longitudinal en +Y y la cara en el plano XY
 * (normal +Z); luego el grupo se orienta e inserta entre las manos.
 */
function buildRacket(color: THREE.Color): { group: THREE.Group; face: THREE.Mesh } {
  const group = new THREE.Group()
  const handleMat = new THREE.MeshStandardMaterial({ color: HANDLE_COLOR })
  const frameMat = new THREE.MeshStandardMaterial({ color })

  // Grip (puño): cilindro oscuro centrado en el origen, donde agarran las manos.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.019, 0.16, LIMB_SEGMENTS),
    handleMat,
  )
  handle.position.y = 0.0
  group.add(handle)

  // Remate del puño (butt cap): disco algo más ancho al final del mango.
  const butt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.02, LIMB_SEGMENTS),
    handleMat,
  )
  butt.position.y = -0.09
  group.add(butt)

  // Puente/cuello triangular que une el mango con la cara (color de la pala).
  const bridgeShape = new THREE.Shape()
  bridgeShape.moveTo(-0.035, 0)
  bridgeShape.lineTo(0.035, 0)
  bridgeShape.lineTo(0, 0.11)
  bridgeShape.lineTo(-0.035, 0)
  const bridge = new THREE.Mesh(new THREE.ShapeGeometry(bridgeShape), frameMat)
  bridge.material.side = THREE.DoubleSide
  bridge.position.set(0, 0.08, 0)
  group.add(bridge)

  // Cara: disco redondo con grosor (extruido). Los agujeros se pintan con
  // `alphaMap`. Se apoya por su parte baja en el cuello/puente.
  const face = buildRacketFace(color)
  face.position.set(0, 0.17, 0)
  group.add(face)

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

  return { group, face }
}

// Geometría de la cara (metros).
const FACE_RADIUS = 0.15 // radio de la cara redonda (Ø 0,30 m)
const FACE_THICKNESS = 0.02 // grosor del disco (canto)

/**
 * Cara de la pala: disco **redondo** y con **grosor** (3D), con agujeros por
 * transparencia.
 *
 * La silueta es un círculo (una pala de pádel es prácticamente redonda) apoyado
 * por su parte baja en el cuello (origen local). En vez de una lámina plana
 * (`ShapeGeometry`), se **extruye** el círculo (`ExtrudeGeometry`) para darle
 * canto —con un pequeño bisel que redondea los bordes— de modo que se aprecie el
 * volumen. El disco se centra en su plano local (Z) para que el grupo lo siga
 * orientando igual.
 *
 * Los agujeros se pintan con un `alphaMap` procedural (rejilla de círculos
 * transparentes) en lugar de perforar geometría, para no disparar el recuento de
 * triángulos con muchos avatares. Se recalculan las UV a [0, 1] a partir de la
 * caja envolvente en XY: como los agujeros ocupan solo el interior del círculo,
 * el canto (perímetro, UV al borde) queda opaco y hace de marco.
 */
function buildRacketFace(color: THREE.Color): THREE.Mesh {
  const R = FACE_RADIUS

  // Círculo con centro en (0, R): su punto más bajo toca el cuello (0, 0).
  const shape = new THREE.Shape()
  shape.absarc(0, R, R, 0, Math.PI * 2, false)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: FACE_THICKNESS,
    curveSegments: 24, // suavidad del contorno redondo
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  })
  // Centrar el disco en su plano local (la extrusión va de z=0 a z=depth+bisel).
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  geo.translate(0, 0, -(bb.min.z + bb.max.z) / 2)
  remapUVToUnit(geo)

  const mat = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    alphaMap: getRacketHolesAlphaMap(),
    transparent: true,
    alphaTest: 0.5, // recorte limpio de los agujeros (sin problemas de orden)
  })

  return new THREE.Mesh(geo, mat)
}

/**
 * Recalcula el atributo UV de una geometría plana (en el plano XY) para que sus
 * coordenadas cubran el rango [0, 1] según su caja envolvente. `ShapeGeometry`
 * usa las coordenadas del `Shape` como UV, que aquí no están normalizadas.
 */
function remapUVToUnit(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const w = bb.max.x - bb.min.x || 1
  const h = bb.max.y - bb.min.y || 1
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / w
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

// La `alphaMap` de agujeros es idéntica para todas las palas (no depende del
// color): se genera una sola vez y se comparte entre todos los avatares.
let sharedRacketHolesAlphaMap: THREE.DataTexture | null = null

/** Devuelve la `alphaMap` de agujeros compartida, creándola la primera vez. */
function getRacketHolesAlphaMap(): THREE.DataTexture {
  if (!sharedRacketHolesAlphaMap) {
    sharedRacketHolesAlphaMap = buildRacketHolesAlphaMap()
  }
  return sharedRacketHolesAlphaMap
}

/**
 * Genera por código una `alphaMap` con la rejilla de agujeros de la pala: una
 * textura de datos (sin necesidad de canvas/DOM) donde los círculos son
 * transparentes (canal 0) y el resto opaco (255). Three.js muestrea el canal
 * verde para el `alphaMap`, pero se rellenan todos los canales por claridad.
 *
 * Como la cara es redonda, los agujeros se disponen en una rejilla recortada a
 * un círculo (centro (0.5, 0.5) en UV) algo más pequeño que la cara, dejando un
 * marco opaco en el borde. Los agujeros son pequeños (radio ~0,022 en UV) para
 * parecerse a los de una pala real; la resolución es alta para que salgan
 * nítidos pese a su tamaño.
 */
function buildRacketHolesAlphaMap(): THREE.DataTexture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  const cols = 8
  const rows = 8
  const holeRadius = size * 0.022 // agujeros pequeños
  const patternRadius = 0.37 // radio (en UV) del círculo que contiene los agujeros

  // Rejilla de candidatos en [0.1, 0.9]²; se conservan los que caen dentro del
  // círculo del patrón, formando una nube circular de agujeros.
  const centers: Array<[number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = 0.1 + (c / (cols - 1)) * 0.8
      const v = 0.1 + (r / (rows - 1)) * 0.8
      const du = u - 0.5
      const dv = v - 0.5
      if (du * du + dv * dv <= patternRadius * patternRadius) {
        centers.push([u * size, v * size])
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let opaque = 255
      for (const [cx, cy] of centers) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        if (dx * dx + dy * dy <= holeRadius * holeRadius) {
          opaque = 0
          break
        }
      }
      const idx = (y * size + x) * 4
      data[idx] = opaque
      data[idx + 1] = opaque
      data[idx + 2] = opaque
      data[idx + 3] = 255
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

/**
 * Esfera de articulación (rodilla, cadera, tobillo…) centrada en el origen del
 * grupo articulación. Redondea la unión entre dos segmentos y tapa el escalón de
 * radio entre ellos. Baja resolución para conservar el estilo low-poly.
 */
function jointSphere(radius: number, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, LIMB_SEGMENTS + 2, LIMB_SEGMENTS)
  return new THREE.Mesh(geo, material)
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
