import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PlayerAvatar } from '../PlayerAvatar'

/**
 * Tests estructurales del avatar de jugador.
 *
 * No comprueban el render, sino la geometría construida: que sea un
 * `THREE.Group`, que tenga cuerpo (cápsula) y cabeza (esfera), su escala humana
 * en metros y que el color de equipo llegue al material del cuerpo.
 */

/** Caja envolvente del avatar en el espacio del mundo. */
function boundingBox(avatar: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(avatar)
}

describe('PlayerAvatar', () => {
  it('es un THREE.Group', () => {
    const avatar = new PlayerAvatar()
    expect(avatar).toBeInstanceOf(THREE.Group)
  })

  it('se compone de cuerpo (cápsula) y cabeza (esfera)', () => {
    const avatar = new PlayerAvatar()
    expect(avatar.children).toHaveLength(2)
    expect(avatar.body.geometry).toBeInstanceOf(THREE.CapsuleGeometry)
    expect(avatar.head.geometry).toBeInstanceOf(THREE.SphereGeometry)
  })

  it('aplica el color de equipo al material del cuerpo', () => {
    const avatar = new PlayerAvatar(0xff0000)
    const mat = avatar.body.material as THREE.MeshStandardMaterial
    expect(mat.color.getHex()).toBe(0xff0000)
  })

  it('permite cambiar el color de equipo después de crearlo', () => {
    const avatar = new PlayerAvatar(0xff0000)
    avatar.setTeamColor(0x0000ff)
    const mat = avatar.body.material as THREE.MeshStandardMaterial
    expect(mat.color.getHex()).toBe(0x0000ff)
  })

  it('tiene escala humana coherente con la pista (~1,7–1,8 m de alto)', () => {
    const avatar = new PlayerAvatar()
    const box = boundingBox(avatar)
    const height = box.max.y - box.min.y
    expect(height).toBeGreaterThanOrEqual(1.7)
    expect(height).toBeLessThanOrEqual(1.8)
  })

  it('apoya los pies sobre el suelo (y ≈ 0)', () => {
    const avatar = new PlayerAvatar()
    const box = boundingBox(avatar)
    expect(box.min.y).toBeCloseTo(0, 2)
  })

  it('coloca la cabeza por encima del cuerpo', () => {
    const avatar = new PlayerAvatar()
    expect(avatar.head.position.y).toBeGreaterThan(avatar.body.position.y)
  })
})
