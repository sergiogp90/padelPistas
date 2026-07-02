import * as THREE from 'three'

/**
 * Avatar de jugador estilizado (low-poly).
 *
 * Figura humana simple y reutilizable pensada para poblar la pista sin recurrir
 * a modelos realistas (ver decisión de arquitectura «avatares estilizados»).
 * Se construye con primitivas de Three.js: una cápsula para el cuerpo y una
 * esfera para la cabeza. Recibe un **color de equipo** que se aplica al
 * material del cuerpo, de modo que dos equipos se distingan de un vistazo.
 *
 * Escala humana coherente con la pista en metros: ~1,75 m de alto.
 *
 * No depende del DOM: es instanciable y comprobable de forma estructural.
 */

// Proporciones en metros. Los pies se sitúan en y = 0 y la coronilla en
// AVATAR_HEIGHT, de modo que el avatar «apoya» sobre el suelo de la pista.
const AVATAR_HEIGHT = 1.75

// Cuerpo: cápsula (cilindro rematado por dos semiesferas).
// La altura total de la cápsula es CYLINDER_LENGTH + 2 * BODY_RADIUS.
const BODY_RADIUS = 0.22
const BODY_TOTAL_H = 1.42
const CYLINDER_LENGTH = BODY_TOTAL_H - 2 * BODY_RADIUS // 0.98

// Cabeza: esfera apoyada sobre el cuerpo; su coronilla marca AVATAR_HEIGHT.
const HEAD_RADIUS = 0.15
const HEAD_CENTER_Y = AVATAR_HEIGHT - HEAD_RADIUS // 1.60

// Segmentos bajos para conservar el estilo low-poly.
const BODY_SEGMENTS = 8
const HEAD_SEGMENTS = 12

// Color neutro (piel) para la cabeza; el cuerpo lleva el color de equipo.
const HEAD_COLOR = 0xf1c9a5

export class PlayerAvatar extends THREE.Group {
  /** Malla del cuerpo, cuyo material lleva el color del equipo. */
  readonly body: THREE.Mesh
  /** Malla de la cabeza. */
  readonly head: THREE.Mesh

  constructor(teamColor: THREE.ColorRepresentation = 0xffffff) {
    super()

    this.body = buildBody(teamColor)
    this.head = buildHead()

    this.add(this.body)
    this.add(this.head)
  }

  /** Cambia el color de equipo aplicado al material del cuerpo. */
  setTeamColor(teamColor: THREE.ColorRepresentation): void {
    ;(this.body.material as THREE.MeshStandardMaterial).color.set(teamColor)
  }
}

function buildBody(teamColor: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(
    BODY_RADIUS,
    CYLINDER_LENGTH,
    BODY_SEGMENTS / 2,
    BODY_SEGMENTS,
  )
  const mat = new THREE.MeshStandardMaterial({ color: teamColor })
  const mesh = new THREE.Mesh(geo, mat)
  // Centro de la cápsula a media altura del cuerpo.
  mesh.position.y = BODY_TOTAL_H / 2
  return mesh
}

function buildHead(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(HEAD_RADIUS, HEAD_SEGMENTS, HEAD_SEGMENTS)
  const mat = new THREE.MeshStandardMaterial({ color: HEAD_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = HEAD_CENTER_Y
  return mesh
}
