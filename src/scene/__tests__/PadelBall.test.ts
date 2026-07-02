import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PadelBall, pickOpponent, arcPosition, bouncePosition } from '../PadelBall'

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

describe('bouncePosition', () => {
  const from = new THREE.Vector3(0, 0.85, -8)
  const bounce = new THREE.Vector3(0, 0.06, 1)
  const to = new THREE.Vector3(0, 0.85, 8)
  const out = new THREE.Vector3()
  const AT = 0.68

  it('en los extremos coincide con origen y destino', () => {
    bouncePosition(from, bounce, to, 2, 1, AT, 0, out)
    expect(out.x).toBeCloseTo(from.x, 5)
    expect(out.y).toBeCloseTo(from.y, 5)
    expect(out.z).toBeCloseTo(from.z, 5)
    bouncePosition(from, bounce, to, 2, 1, AT, 1, out)
    expect(out.x).toBeCloseTo(to.x, 5)
    expect(out.y).toBeCloseTo(to.y, 5)
    expect(out.z).toBeCloseTo(to.z, 5)
  })

  it('en el instante del bote toca el punto de bote (en el suelo)', () => {
    bouncePosition(from, bounce, to, 2, 1, AT, AT, out)
    expect(out.x).toBeCloseTo(bounce.x, 5)
    expect(out.z).toBeCloseTo(bounce.z, 5)
    expect(out.y).toBeCloseTo(bounce.y, 5)
  })

  it('sube por encima del suelo entre los golpeos y el bote', () => {
    // A mitad del primer arco la pelota está claramente por encima del bote.
    bouncePosition(from, bounce, to, 2, 1, AT, AT / 2, out)
    expect(out.y).toBeGreaterThan(bounce.y)
  })
})

/** Índice mínimo de `y` que alcanza la pelota durante su primer vuelo (~0,68 s). */
function minYDuringFirstFlight(ball: PadelBall): number {
  let minY = Infinity
  // rng=()=>0 fija la duración del vuelo en 0,7 s; recorremos justo por debajo.
  for (let t = 0; t < 0.68; t += 0.02) {
    ball.update(0.02)
    minY = Math.min(minY, ball.position.y)
  }
  return minY
}

describe('PadelBall — bote según la posición del receptor', () => {
  it('bota antes en el suelo si el receptor está retrasado', () => {
    // Poseedor en la red; sus dos rivales están al fondo (|z| ≥ línea de saque).
    const players = [
      { position: new THREE.Vector3(-2.5, 0, -3) }, // equipo 0 (saca este)
      { position: new THREE.Vector3(2.5, 0, -3) }, // equipo 0
      { position: new THREE.Vector3(-2.5, 0, 8) }, // equipo 1 (retrasado)
      { position: new THREE.Vector3(2.5, 0, 8) }, // equipo 1 (retrasado)
    ]
    const ball = new PadelBall(players, [0, 0, 1, 1] as const, { rng: () => 0 })
    // El primer golpe va a un rival retrasado: la pelota debe picar cerca del suelo.
    expect(minYDuringFirstFlight(ball)).toBeLessThan(0.2)
  })

  it('no bota si el receptor está adelantado (en la red)', () => {
    // Todos los rivales del poseedor están en la red: vuelo directo, sin bote.
    const players = [
      { position: new THREE.Vector3(-2.5, 0, -3) }, // equipo 0 (saca este)
      { position: new THREE.Vector3(2.5, 0, -3) }, // equipo 0
      { position: new THREE.Vector3(-2.5, 0, 3) }, // equipo 1 (en la red)
      { position: new THREE.Vector3(2.5, 0, 3) }, // equipo 1 (en la red)
    ]
    const ball = new PadelBall(players, [0, 0, 1, 1] as const, { rng: () => 0 })
    // Vuelo directo: la parábola solo sube, nunca se acerca al suelo.
    expect(minYDuringFirstFlight(ball)).toBeGreaterThan(0.5)
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
      // Detecta un golpeo: la pelota a la altura base (y ≈ 0,85) Y pegada a un
      // jugador. La condición de proximidad es necesaria porque, en los vuelos
      // con bote, la pelota vuelve a cruzar esa altura a media pista (sin ser un
      // golpeo), y ahí no está cerca de nadie.
      if (Math.abs(ball.position.y - 0.85) < 0.02) {
        const nearest = nearestPlayer(players, ball.position)
        const np = players[nearest].position
        const d = Math.hypot(np.x - ball.position.x, np.z - ball.position.z)
        if (d < 0.5 && nearest !== prev) {
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
