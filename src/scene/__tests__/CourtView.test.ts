import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CourtView, TEAM_COLORS } from '../CourtView'
import { PadelCourt } from '../PadelCourt'
import { PlayerAvatar } from '../PlayerAvatar'
import type { DataSource } from '../../data/DataSource'
import type { Court } from '../../types'

/**
 * Tests estructurales de `CourtView`.
 *
 * No comprueban el render 3D ni la simulación, sino que la vista ensambla lo
 * esperado: el sub-árbol 3D (una `PadelCourt` colocada según la celda) y el
 * marcador overlay vinculado al `DataSource`.
 */

/** `DataSource` de prueba controlable: emite cuando se le pide, sin temporizadores. */
function createFakeSource(initial: Court) {
  let court = initial
  const listeners = new Set<(c: Court) => void>()
  const source: DataSource = {
    getCourt: () => court,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const emit = (next: Court) => {
    court = next
    listeners.forEach((l) => l(next))
  }
  return { source, emit }
}

function buildCourt(name: string, point: 0 | 15 | 30 | 40 = 0): Court {
  return {
    id: 1,
    name,
    match: {
      teams: [
        { players: [{ name: 'Carlos Ruiz' }, { name: 'Miguel Sánchez' }] },
        { players: [{ name: 'Pablo García' }, { name: 'Javier López' }] },
      ],
      score: {
        currentPoint: [point, 0],
        games: [[0, 0]],
        sets: [0, 0],
      },
    },
  }
}

/** Punto del primer equipo (excluye la etiqueta "Punto" de la cabecera). */
const team0Point = (el: HTMLElement) =>
  el.querySelector(
    '.scoreboard__row:not(.scoreboard__row--header) .scoreboard__point',
  )?.textContent

describe('CourtView', () => {
  it('expone un THREE.Group como sub-árbol 3D', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.object3D).toBeInstanceOf(THREE.Group)
  })

  it('monta una PadelCourt dentro del sub-árbol 3D', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.court).toBeInstanceOf(PadelCourt)
    expect(view.object3D.children).toContain(view.court)
  })

  it('posee su propia escena con la pista y luces', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.scene).toBeInstanceOf(THREE.Scene)
    expect(view.scene.children).toContain(view.object3D)
    // Escena autocontenida: incluye sus propias luces (ambiental + direccional).
    expect(view.scene.children.some((c) => c instanceof THREE.Light)).toBe(true)
  })

  it('posee su propia cámara de perspectiva', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.camera).toBeInstanceOf(THREE.PerspectiveCamera)
  })

  it('reencuadra la cámara al aspecto de su celda con frame()', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    view.frame(16 / 9)

    expect(view.camera.aspect).toBe(16 / 9)
    expect(Number.isFinite(view.camera.position.length())).toBe(true)
    expect(view.camera.position.length()).toBeGreaterThan(0)
  })

  it('coloca la pista en el origen con la celda por defecto (sin cambio visible)', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.object3D.position.toArray()).toEqual([0, 0, 0])
  })

  it('coloca la pista según la celda indicada (x, z)', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source, { x: 30, z: -12 })

    expect(view.object3D.position.toArray()).toEqual([30, 0, -12])
  })

  it('coloca 4 jugadores (2 por equipo) dentro del sub-árbol 3D', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    expect(view.players).toHaveLength(4)
    for (const player of view.players) {
      expect(player).toBeInstanceOf(PlayerAvatar)
      expect(view.object3D.children).toContain(player)
    }
  })

  it('reparte los jugadores a cada lado de la red (Z<0 y Z>0)', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    const nearSide = view.players.filter((p) => p.position.z < 0)
    const farSide = view.players.filter((p) => p.position.z > 0)
    expect(nearSide).toHaveLength(2)
    expect(farSide).toHaveLength(2)
  })

  it('separa en X a los dos jugadores de cada mitad', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    for (const half of [(p: PlayerAvatar) => p.position.z < 0, (p: PlayerAvatar) => p.position.z > 0]) {
      const [a, b] = view.players.filter(half)
      expect(a.position.x).not.toBe(b.position.x)
    }
  })

  it('mantiene a los jugadores dentro de los límites de la pista (±5 en X, ±10 en Z)', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    for (const player of view.players) {
      expect(Math.abs(player.position.x)).toBeLessThan(5)
      expect(Math.abs(player.position.z)).toBeLessThan(10)
    }
  })

  it('aplica el color de equipo al cuerpo de cada avatar', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    for (const player of view.players) {
      const color = (player.body.material as THREE.MeshStandardMaterial).color.getHex()
      const team0 = new THREE.Color(TEAM_COLORS[0]).getHex()
      const team1 = new THREE.Color(TEAM_COLORS[1]).getHex()
      const nearSide = player.position.z < 0
      expect(color).toBe(nearSide ? team0 : team1)
    }
  })

  it('orienta al equipo lejano (Z>0) mirando hacia la red', () => {
    const { source } = createFakeSource(buildCourt('Pista Central'))
    const view = new CourtView(source)

    for (const player of view.players) {
      // El avatar mira a +Z; el equipo de Z>0 se gira 180° para encarar la red.
      const expected = player.position.z > 0 ? Math.PI : 0
      expect(player.rotation.y).toBeCloseTo(expected, 5)
    }
  })

  it('monta el marcador con el estado inicial de la fuente', () => {
    const { source } = createFakeSource(buildCourt('Pista Norte', 15))
    const view = new CourtView(source)

    expect(view.scoreboardEl).toBeInstanceOf(HTMLElement)
    expect(view.scoreboardEl.textContent).toContain('Pista Norte')
    expect(team0Point(view.scoreboardEl)).toBe('15')
  })

  it('re-renderiza el marcador ante cambios de la fuente', () => {
    const { source, emit } = createFakeSource(buildCourt('Pista Sur', 0))
    const view = new CourtView(source)

    expect(team0Point(view.scoreboardEl)).toBe('0')

    emit(buildCourt('Pista Sur', 40))

    expect(team0Point(view.scoreboardEl)).toBe('40')
  })

  it('deja de re-renderizar el marcador tras dispose()', () => {
    const { source, emit } = createFakeSource(buildCourt('Pista Este', 0))
    const view = new CourtView(source)

    view.dispose()
    emit(buildCourt('Pista Este', 40))

    expect(team0Point(view.scoreboardEl)).toBe('0')
  })
})
