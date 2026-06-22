import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createCamera, frameCourt } from './createCamera'

// Caja envolvente de la pista en coordenadas de mundo (metros).
// Debe coincidir con COURT_LENGTH=20 (Z), COURT_WIDTH=10 (X), COURT_HEIGHT=4 (Y)
// de createCamera.ts.
const worldCorners: THREE.Vector3[] = []
for (const x of [-5, 5]) {
  for (const y of [0, 4]) {
    for (const z of [-10, 10]) {
      worldCorners.push(new THREE.Vector3(x, y, z))
    }
  }
}

// Proyecta los puntos dados a NDC con la cámara, asegurando que sus matrices
// están actualizadas (en tests no hay renderer que las recalcule).
function projectAll(
  points: THREE.Vector3[],
  camera: THREE.PerspectiveCamera,
): THREE.Vector3[] {
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  return points.map((p) => p.clone().project(camera))
}

const ASPECTS = {
  apaisado: 16 / 9,
  vertical: 9 / 16,
} as const

describe('frameCourt', () => {
  for (const [nombre, aspect] of Object.entries(ASPECTS)) {
    describe(`aspecto ${nombre} (${aspect.toFixed(3)})`, () => {
      const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
      frameCourt(camera)

      it('mantiene las 8 esquinas de la pista dentro del frustum', () => {
        const ndc = projectAll(worldCorners, camera)
        for (const c of ndc) {
          expect(c.x).toBeGreaterThanOrEqual(-1)
          expect(c.x).toBeLessThanOrEqual(1)
          expect(c.y).toBeGreaterThanOrEqual(-1)
          expect(c.y).toBeLessThanOrEqual(1)
          // z en [-1, 1] => entre los planos near y far.
          expect(c.z).toBeGreaterThanOrEqual(-1)
          expect(c.z).toBeLessThanOrEqual(1)
        }
      })

      it('coloca la cámara a una distancia positiva y finita', () => {
        expect(camera.position.x).toBeTypeOf('number')
        expect(Number.isFinite(camera.position.x)).toBe(true)
        expect(Number.isFinite(camera.position.y)).toBe(true)
        expect(Number.isFinite(camera.position.z)).toBe(true)
        // La cámara se aleja del origen (la pista está centrada cerca de él).
        expect(camera.position.length()).toBeGreaterThan(0)
      })

      it('reserva la franja izquierda y desplaza la pista a la derecha (LEFT_RESERVE)', () => {
        const ndc = projectAll(worldCorners, camera)
        const centroX =
          ndc.reduce((sum, c) => sum + c.x, 0) / ndc.length
        // El centro de la pista queda en la mitad derecha del encuadre,
        // dejando hueco a la izquierda para el marcador.
        expect(centroX).toBeGreaterThan(0)

        // El centro de la pista (TARGET, en y=1) también cae a la derecha.
        const [centroTarget] = projectAll(
          [new THREE.Vector3(0, 1, 0)],
          camera,
        )
        expect(centroTarget.x).toBeGreaterThan(0)
      })
    })
  }

  it('encuadra de forma distinta según cambie el aspecto', () => {
    const apaisada = new THREE.PerspectiveCamera(45, ASPECTS.apaisado, 0.1, 1000)
    const vertical = new THREE.PerspectiveCamera(45, ASPECTS.vertical, 0.1, 1000)
    frameCourt(apaisada)
    frameCourt(vertical)

    // En vertical hay menos ancho disponible, así que la cámara debe alejarse
    // más para encuadrar la misma pista.
    expect(vertical.position.length()).toBeGreaterThan(apaisada.position.length())
  })
})

describe('createCamera', () => {
  it('devuelve una PerspectiveCamera con FOV y aspecto correctos', () => {
    const aspect = 16 / 9
    const camera = createCamera(aspect)
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
    expect(camera.fov).toBe(45)
    expect(camera.aspect).toBe(aspect)
  })

  it('devuelve la cámara ya encuadrada (esquinas dentro del frustum)', () => {
    const camera = createCamera(9 / 16)
    const ndc = projectAll(worldCorners, camera)
    for (const c of ndc) {
      expect(Math.abs(c.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(c.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(c.z)).toBeLessThanOrEqual(1)
    }
  })
})
