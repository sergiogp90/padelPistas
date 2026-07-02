import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PlayerAvatar } from '../PlayerAvatar'

/**
 * Tests estructurales del avatar de jugador.
 *
 * No comprueban el render, sino la geometría construida: que sea un
 * `THREE.Group`, que tenga las partes esperadas (cuerpo, cabeza, rostro, pelo,
 * brazos, manos, piernas, pala y gorra opcional), su escala humana en metros y
 * que los colores lleguen a los materiales correctos.
 *
 * La aleatoriedad (color de pala y presencia de gorra) se fija inyectando un
 * `rng` determinista o pasando opciones explícitas.
 */

/** Caja envolvente del avatar en el espacio del mundo. */
function boundingBox(avatar: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(avatar)
}

/** `rng` determinista que siempre devuelve el mismo valor. */
function constantRng(value: number): () => number {
  return () => value
}

describe('PlayerAvatar', () => {
  it('es un THREE.Group', () => {
    const avatar = new PlayerAvatar()
    expect(avatar).toBeInstanceOf(THREE.Group)
  })

  it('tiene cuerpo (cápsula) y cabeza (esfera)', () => {
    const avatar = new PlayerAvatar()
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
    // Se comprueba con y sin gorra: ninguna variante debe salirse del rango.
    for (const hasCap of [false, true]) {
      const avatar = new PlayerAvatar(0xffffff, { hasCap })
      const box = boundingBox(avatar)
      const height = box.max.y - box.min.y
      expect(height).toBeGreaterThanOrEqual(1.7)
      expect(height).toBeLessThanOrEqual(1.8)
    }
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

  it('tiene rostro (dos ojos) y pelo en la cabeza', () => {
    const avatar = new PlayerAvatar()
    expect(avatar.eyes).toHaveLength(2)
    expect(avatar.hair).toBeInstanceOf(THREE.Mesh)
    // El rostro y el pelo cuelgan de la cabeza para moverse con ella.
    for (const eye of avatar.eyes) {
      expect(eye.parent).toBe(avatar.head)
    }
    expect(avatar.hair.parent).toBe(avatar.head)
  })

  it('tiene brazos y dos manos', () => {
    const avatar = new PlayerAvatar()
    expect(avatar.hands).toHaveLength(2)
    // Brazo + antebrazo + mano por lado = 6 elementos como mínimo.
    expect(avatar.arms.children.length).toBeGreaterThanOrEqual(6)
  })

  it('tiene dos piernas con pies (rodillas flexionadas hacia delante)', () => {
    const avatar = new PlayerAvatar()
    // Muslo + espinilla + pie por pierna = 6 elementos.
    expect(avatar.legs.children.length).toBeGreaterThanOrEqual(6)
    // Los pies (cajas) se adelantan respecto de la cadera (z > 0) por la flexión.
    const feet = avatar.legs.children.filter(
      (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry,
    )
    expect(feet).toHaveLength(2)
    for (const foot of feet) {
      expect(foot.position.z).toBeGreaterThan(0)
    }
  })

  it('sujeta una pala de pádel con ambas manos', () => {
    const avatar = new PlayerAvatar()
    expect(avatar.racket).toBeInstanceOf(THREE.Group)
    expect(avatar.racket.children.length).toBeGreaterThan(0)
    // Las dos manos están próximas entre sí y por delante del cuerpo (z > 0),
    // como agarrando el mango.
    const [left, right] = avatar.hands
    expect(left.position.z).toBeGreaterThan(0)
    expect(right.position.z).toBeGreaterThan(0)
    expect(Math.abs(left.position.x - right.position.x)).toBeLessThan(0.2)
  })

  it('sujeta la pala estirada hacia delante (apunta a +Z, no hacia arriba)', () => {
    const avatar = new PlayerAvatar()
    avatar.updateMatrixWorld(true)
    // Eje de la pala (local +Y) expresado en el mundo.
    const dir = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(avatar.racket.getWorldQuaternion(new THREE.Quaternion()))
      .normalize()
    // Debe apuntar mayormente hacia delante (+Z), no hacia arriba (+Y).
    expect(dir.z).toBeGreaterThan(0.7)
    expect(dir.z).toBeGreaterThan(dir.y)
  })

  it('mantiene la cara de la pala vertical, de canto (normal ≈ eje X)', () => {
    const avatar = new PlayerAvatar()
    avatar.updateMatrixWorld(true)
    const q = avatar.racket.getWorldQuaternion(new THREE.Quaternion())
    // Normal de la cara de la pala (local +Z) expresada en el mundo.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize()
    // La cara mira al lateral (±X): el canto lateral queda perpendicular a X.
    expect(Math.abs(normal.x)).toBeGreaterThan(0.9)
    expect(Math.abs(normal.y)).toBeLessThan(0.2)
    // El eje de la pala (local +Y) sigue apuntando hacia delante (+Z).
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize()
    expect(axis.z).toBeGreaterThan(0.7)
  })

  it('genera un color de pala aleatorio a partir del rng', () => {
    const a = new PlayerAvatar(0xffffff, { rng: constantRng(0.1) })
    const b = new PlayerAvatar(0xffffff, { rng: constantRng(0.8) })
    expect(a.racketColor.getHex()).not.toBe(b.racketColor.getHex())
  })

  it('respeta un color de pala explícito', () => {
    const avatar = new PlayerAvatar(0xffffff, { racketColor: 0x00ff00 })
    expect(avatar.racketColor.getHex()).toBe(0x00ff00)
  })

  it('decide la gorra aleatoriamente según el rng', () => {
    // rng < 0.5 → con gorra; rng >= 0.5 → sin gorra.
    const conGorra = new PlayerAvatar(0xffffff, { rng: constantRng(0.2) })
    const sinGorra = new PlayerAvatar(0xffffff, { rng: constantRng(0.9) })
    expect(conGorra.hasCap).toBe(true)
    expect(conGorra.cap).toBeInstanceOf(THREE.Mesh)
    expect(sinGorra.hasCap).toBe(false)
    expect(sinGorra.cap).toBeNull()
  })

  it('respeta la presencia de gorra indicada por opción', () => {
    expect(new PlayerAvatar(0xffffff, { hasCap: true }).cap).toBeInstanceOf(
      THREE.Mesh,
    )
    expect(new PlayerAvatar(0xffffff, { hasCap: false }).cap).toBeNull()
  })
})
