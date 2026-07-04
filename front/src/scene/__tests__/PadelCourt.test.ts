import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PadelCourt } from '../PadelCourt'

/**
 * Tests estructurales de la pista.
 *
 * No comprueban el render, sino la geometría construida: número de
 * sub-grupos, mallas clave y constantes de construcción. Su objetivo es
 * detectar regresiones cuando se modifica `PadelCourt.ts`.
 */

/** Mallas (`THREE.Mesh`) directas de un objeto, sin descender recursivamente. */
function directMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  return obj.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
}

/** Recorre el árbol completo y devuelve todas las mallas. */
function allMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh)
  })
  return out
}

describe('PadelCourt', () => {
  it('es un THREE.Group', () => {
    const court = new PadelCourt()
    expect(court).toBeInstanceOf(THREE.Group)
  })

  it('contiene los 8 sub-elementos esperados en orden (suelo, líneas, red, paredes traseras, cristal lat.1, cristal lat.2, reja, postes)', () => {
    const court = new PadelCourt()
    expect(court.children).toHaveLength(8)

    // 0: suelo es una malla; el resto son sub-grupos.
    const [floor, ...rest] = court.children
    expect((floor as THREE.Mesh).isMesh).toBe(true)
    for (const group of rest) {
      expect(group).toBeInstanceOf(THREE.Group)
    }
  })

  it('el suelo es un plano de 10×20 (ancho × largo de la pista)', () => {
    const court = new PadelCourt()
    const floor = court.children[0] as THREE.Mesh
    const geo = floor.geometry as THREE.PlaneGeometry
    expect(geo).toBeInstanceOf(THREE.PlaneGeometry)
    expect(geo.parameters.width).toBe(10)
    expect(geo.parameters.height).toBe(20)
  })

  it('dibuja 7 líneas (4 perímetro + 2 servicio + 1 central)', () => {
    const court = new PadelCourt()
    const lines = court.children[1]
    expect(directMeshes(lines)).toHaveLength(7)
  })

  it('la red tiene 4 elementos (malla, banda y 2 postes)', () => {
    const court = new PadelCourt()
    const net = court.children[2]
    expect(directMeshes(net)).toHaveLength(4)
  })

  it('divide cada cristal trasero en 5 paneles', () => {
    const court = new PadelCourt()
    const backWalls = court.children[3]

    // Paneles de cristal: BoxGeometry de 2m de ancho y 3m de alto.
    const panels = directMeshes(backWalls).filter((m) => {
      const p = (m.geometry as THREE.BoxGeometry).parameters
      return p && p.width === 2 && p.height === 3
    })

    // 5 paneles por cada pared trasera (Z = -10 y Z = +10) → 10 en total.
    expect(panels).toHaveLength(10)
  })

  it('separa los paneles traseros con 4 postes por pared (5 paneles → 4 juntas)', () => {
    const court = new PadelCourt()
    const backWalls = court.children[3]

    // Postes separadores: BoxGeometry de 0.06m de ancho.
    const posts = directMeshes(backWalls).filter((m) => {
      const p = (m.geometry as THREE.BoxGeometry).parameters
      return p && p.width === 0.06
    })

    // 4 postes por cada una de las 2 paredes traseras → 8 en total.
    expect(posts).toHaveLength(8)
  })

  it('genera 4 postes de foco (uno por esquina interior)', () => {
    const court = new PadelCourt()
    const poles = court.children[7]

    // Cada poste es un cilindro de 6m de alto.
    const poleMeshes = directMeshes(poles).filter((m) => {
      const g = m.geometry as THREE.CylinderGeometry
      return g instanceof THREE.CylinderGeometry && g.parameters.height === 6
    })
    expect(poleMeshes).toHaveLength(4)

    // Situados en las 4 esquinas interiores: X = ±5, Z = ±6.
    const corners = poleMeshes.map((m) => `${m.position.x},${m.position.z}`).sort()
    expect(corners).toEqual(['-5,-6', '-5,6', '5,-6', '5,6'])
  })

  it('coloca una luz puntual por cada poste de foco (4 en total)', () => {
    const court = new PadelCourt()
    const lights: THREE.PointLight[] = []
    court.traverse((c) => {
      if ((c as THREE.PointLight).isPointLight) lights.push(c as THREE.PointLight)
    })
    expect(lights).toHaveLength(4)
  })

  it('mantiene el conteo total de mallas estable (invariante de regresión)', () => {
    const court = new PadelCourt()
    // suelo(1) + líneas(7) + red(4) + traseras(20) + lat1(8) + lat2(8) + reja(10) + postes(20)
    expect(allMeshes(court)).toHaveLength(78)
  })
})
