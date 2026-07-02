import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PadelBall, pickOpponent, arcPosition } from '../PadelBall'

/**
 * Tests de la pelota de pádel: la restricción de peloteo (nunca entre
 * compañeros), la parábola del vuelo y el ensamblado/animación del objeto 3D.
 */

/** Crea 4 jugadores de prueba con posición fija (2 por equipo). */
function makePlayers(): { position: THREE.Vector3 }[] {
  return [
    { position: new THREE.Vector3(-2.5, 0, -8) }, // equipo 0
    { position: new THREE.Vector3(2.5, 0, -3) }, // equipo 0
    { position: new THREE.Vector3(-2.5, 0, 3) }, // equipo 1
    { position: new THREE.Vector3(2.5, 0, 8) }, // equipo 1
  ]
}

const TEAMS = [0, 0, 1, 1] as const

describe('pickOpponent', () => {
  it('nunca elige a un compañero de equipo', () => {
    for (let holder = 0; holder < TEAMS.length; holder++) {
      // Barre todo el rango de rng para cubrir cada rival posible.
      for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
        const target = pickOpponent(TEAMS, holder, () => r)
        expect(TEAMS[target]).not.toBe(TEAMS[holder])
      }
    }
  })

  it('elige un rival distinto según el rng', () => {
    // Poseedor del equipo 0 → rivales en índices 2 y 3.
    expect(pickOpponent(TEAMS, 0, () => 0)).toBe(2)
    expect(pickOpponent(TEAMS, 0, () => 0.99)).toBe(3)
  })
})

describe('arcPosition', () => {
  const from = new THREE.Vector3(0, 0.85, -8)
  const to = new THREE.Vector3(0, 0.85, 8)
  const out = new THREE.Vector3()

  it('en los extremos coincide con origen y destino (arco = 0)', () => {
    expect(arcPosition(from, to, 2, 0, out).toArray()).toEqual(from.toArray())
    expect(arcPosition(from, to, 2, 1, out).toArray()).toEqual(to.toArray())
  })

  it('en el punto medio alcanza la altura máxima del arco', () => {
    arcPosition(from, to, 2, 0.5, out)
    expect(out.z).toBeCloseTo(0, 5)
    expect(out.y).toBeCloseTo(0.85 + 2, 5) // pico = altura base + arcHeight
  })
})

describe('PadelBall', () => {
  it('es un THREE.Group con la esfera y la costura', () => {
    const ball = new PadelBall(makePlayers(), TEAMS, { rng: () => 0.5 })
    expect(ball).toBeInstanceOf(THREE.Group)
    // Un grupo interno con la malla de la esfera y la de la costura.
    const meshes: THREE.Mesh[] = []
    ball.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })
    expect(meshes.length).toBeGreaterThanOrEqual(2)
  })

  it('arranca a la altura de golpeo', () => {
    const ball = new PadelBall(makePlayers(), TEAMS, { rng: () => 0.3 })
    expect(ball.position.y).toBeCloseTo(0.85, 5)
  })

  it('a lo largo del peloteo siempre pasa entre equipos contrarios', () => {
    const players = makePlayers()
    // rng determinista pero variado (secuencia pseudoaleatoria simple).
    let seed = 1
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const ball = new PadelBall(players, TEAMS, { rng })

    // El poseedor tras cada golpe se puede inferir del jugador más cercano a la
    // pelota cuando toca el suelo de golpeo. En su lugar, comprobamos la
    // invariante observando la posición al llegar a destino: registramos a qué
    // jugador se acerca la pelota justo al aterrizar y que alterna de equipo.
    const holders: number[] = []
    let prev = -1
    for (let i = 0; i < 2000; i++) {
      ball.update(0.05)
      // Detecta cuándo la pelota está en un punto de golpeo (y ≈ altura base).
      if (Math.abs(ball.position.y - 0.85) < 0.02) {
        const nearest = nearestPlayer(players, ball.position)
        if (nearest !== prev) {
          holders.push(nearest)
          prev = nearest
        }
      }
    }

    expect(holders.length).toBeGreaterThan(5)
    for (let i = 1; i < holders.length; i++) {
      expect(TEAMS[holders[i]]).not.toBe(TEAMS[holders[i - 1]])
    }
  })

  it('no sale de la pista durante el peloteo (X, Z dentro de límites)', () => {
    const ball = new PadelBall(makePlayers(), TEAMS, { rng: () => 0.5 })
    for (let i = 0; i < 500; i++) {
      ball.update(0.05)
      expect(Math.abs(ball.position.x)).toBeLessThan(5)
      expect(Math.abs(ball.position.z)).toBeLessThan(10)
      expect(ball.position.y).toBeGreaterThanOrEqual(0)
    }
  })
})

/** Índice del jugador cuya posición (en el plano X/Z) está más cerca del punto. */
function nearestPlayer(
  players: { position: THREE.Vector3 }[],
  point: THREE.Vector3,
): number {
  let best = 0
  let bestD = Infinity
  players.forEach((p, i) => {
    const d = Math.hypot(p.position.x - point.x, p.position.z - point.z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
