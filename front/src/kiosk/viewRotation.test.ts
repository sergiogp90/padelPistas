import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildRotationCycle,
  createViewRotation,
  ROTATION_INTERVAL_MS,
  type RotationView,
} from './viewRotation'

/**
 * Tests de la máquina de estados de rotación de vistas. Comprueban la forma del
 * ciclo (global → cada pista → global) y que el temporizador avanza, envuelve y
 * se pausa/reanuda con la visibilidad de la página. El tiempo se controla con
 * temporizadores falsos y la visibilidad con un doble del `document`.
 */

describe('buildRotationCycle', () => {
  it('empieza en la global y añade una vista por pista, en orden', () => {
    expect(buildRotationCycle(2)).toEqual([
      { kind: 'global' },
      { kind: 'court', index: 0 },
      { kind: 'court', index: 1 },
    ])
  })

  it('con 0 pistas el ciclo es solo la vista global', () => {
    expect(buildRotationCycle(0)).toEqual([{ kind: 'global' }])
  })
})

describe('createViewRotation', () => {
  // Doble mínimo de Document: visibilidad mutable y registro de un único listener
  // de `visibilitychange` que podemos disparar a mano.
  function makeDoc(visibilityState: DocumentVisibilityState = 'visible') {
    let listener: (() => void) | undefined
    const doc = {
      visibilityState,
      addEventListener: (_type: string, cb: () => void) => {
        listener = cb
      },
      removeEventListener: () => {
        listener = undefined
      },
    }
    return {
      doc: doc as unknown as Document,
      setVisibility(state: DocumentVisibilityState) {
        doc.visibilityState = state
        listener?.()
      },
      hasListener: () => listener !== undefined,
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emite la vista global de inmediato al arrancar', () => {
    const { doc } = makeDoc()
    const onChange = vi.fn()

    const rotation = createViewRotation({ courtCount: 3, onChange, doc })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'global' })
    expect(rotation.current).toEqual({ kind: 'global' })

    rotation.stop()
  })

  it('rota a la siguiente vista en cada intervalo y vuelve a la global', () => {
    const { doc } = makeDoc()
    const seen: RotationView[] = []
    const rotation = createViewRotation({
      courtCount: 2,
      onChange: (v) => seen.push(v),
      doc,
    })

    vi.advanceTimersByTime(ROTATION_INTERVAL_MS) // → pista 0
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS) // → pista 1
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS) // → global (vuelta)

    expect(seen).toEqual([
      { kind: 'global' },
      { kind: 'court', index: 0 },
      { kind: 'court', index: 1 },
      { kind: 'global' },
    ])
    expect(rotation.current).toEqual({ kind: 'global' })

    rotation.stop()
  })

  it('respeta un intervalo configurable', () => {
    const { doc } = makeDoc()
    const onChange = vi.fn()
    const rotation = createViewRotation({
      courtCount: 1,
      intervalMs: 5000,
      onChange,
      doc,
    })

    vi.advanceTimersByTime(4999)
    expect(onChange).toHaveBeenCalledTimes(1) // aún la inicial
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'court', index: 0 })

    rotation.stop()
  })

  it('pausa mientras la página está oculta y reanuda al volver', () => {
    const ctx = makeDoc()
    const onChange = vi.fn()
    const rotation = createViewRotation({ courtCount: 2, onChange, doc: ctx.doc })
    onChange.mockClear() // descartar la emisión inicial

    ctx.setVisibility('hidden')
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS * 3)
    expect(onChange).not.toHaveBeenCalled() // no rota estando oculta

    ctx.setVisibility('visible')
    // El intervalo se rearma entero: no salta al reaparecer...
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS - 1)
    expect(onChange).not.toHaveBeenCalled()
    // ...sino tras un intervalo completo desde que volvió a ser visible.
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'court', index: 0 })

    rotation.stop()
  })

  it('no arranca el temporizador si la página nace oculta', () => {
    const ctx = makeDoc('hidden')
    const onChange = vi.fn()
    const rotation = createViewRotation({ courtCount: 2, onChange, doc: ctx.doc })

    // Emite la vista inicial pero no rota mientras siga oculta.
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS * 2)
    expect(onChange).toHaveBeenCalledTimes(1)

    rotation.stop()
  })

  it('stop() detiene la rotación y retira el listener de visibilidad', () => {
    const ctx = makeDoc()
    const onChange = vi.fn()
    const rotation = createViewRotation({ courtCount: 2, onChange, doc: ctx.doc })

    rotation.stop()
    expect(ctx.hasListener()).toBe(false)

    onChange.mockClear()
    vi.advanceTimersByTime(ROTATION_INTERVAL_MS * 3)
    expect(onChange).not.toHaveBeenCalled()
  })
})
