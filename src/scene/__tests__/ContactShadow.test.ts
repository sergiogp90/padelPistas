import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createContactShadow, CONTACT_SHADOW_BASE_OPACITY } from '../ContactShadow'

/**
 * Tests estructurales de la sombra de contacto falsa.
 *
 * No comprueban el render, sino que la malla se construye tumbada en el suelo,
 * con un material transparente sin escritura de profundidad y del tamaño pedido.
 */
describe('ContactShadow', () => {
  it('es una malla de plano tumbada sobre el suelo', () => {
    const shadow = createContactShadow()
    expect(shadow).toBeInstanceOf(THREE.Mesh)
    expect(shadow.geometry).toBeInstanceOf(THREE.PlaneGeometry)
    // Tumbada (normal +Y) y apenas por encima del suelo.
    expect(shadow.rotation.x).toBeCloseTo(-Math.PI / 2, 5)
    expect(shadow.position.y).toBeGreaterThan(0)
    expect(shadow.position.y).toBeLessThan(0.1)
  })

  it('dimensiona el plano según el radio (lado = 2·radio)', () => {
    const shadow = createContactShadow(0.3)
    const geo = shadow.geometry as THREE.PlaneGeometry
    expect(geo.parameters.width).toBeCloseTo(0.6, 5)
    expect(geo.parameters.height).toBeCloseTo(0.6, 5)
  })

  it('usa un material básico transparente, oscuro y sin escritura de profundidad', () => {
    const shadow = createContactShadow()
    const mat = shadow.material as THREE.MeshBasicMaterial
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(mat.transparent).toBe(true)
    expect(mat.depthWrite).toBe(false)
    expect(mat.opacity).toBeCloseTo(CONTACT_SHADOW_BASE_OPACITY, 5)
    expect(mat.color.getHex()).toBe(0x000000)
    expect(mat.map).toBeInstanceOf(THREE.DataTexture)
  })
})
