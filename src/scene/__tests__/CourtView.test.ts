import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { CourtView } from '../CourtView'
import { PadelCourt } from '../PadelCourt'
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
