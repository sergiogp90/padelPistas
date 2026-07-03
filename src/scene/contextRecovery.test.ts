import { describe, it, expect, vi } from 'vitest'
import {
  installContextRecovery,
  type ContextEventTarget,
} from './contextRecovery'

/**
 * Canvas de doble: registra los listeners y permite despacharlos a mano, además
 * de contar cuántos hay vivos por tipo (para comprobar que no se acumulan ni se
 * quedan colgados tras `uninstall`). El evento emite un `preventDefault` espía.
 */
function createFakeCanvas() {
  const listeners = new Map<string, Set<(event: Event) => void>>()
  const canvas: ContextEventTarget = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
  }
  const dispatch = (type: string) => {
    const preventDefault = vi.fn()
    const event = { type, preventDefault } as unknown as Event
    listeners.get(type)?.forEach((l) => l(event))
    return { preventDefault }
  }
  const count = (type: string) => listeners.get(type)?.size ?? 0
  return { canvas, dispatch, count }
}

describe('installContextRecovery', () => {
  it('al perder el contexto llama a preventDefault y a onLost', () => {
    const { canvas, dispatch } = createFakeCanvas()
    const onLost = vi.fn()
    const onRestored = vi.fn()

    installContextRecovery(canvas, { onLost, onRestored })
    const { preventDefault } = dispatch('webglcontextlost')

    // Sin preventDefault el navegador no emitiría `webglcontextrestored`.
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onLost).toHaveBeenCalledTimes(1)
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('al restaurar el contexto llama a onRestored (sin recargar)', () => {
    const { canvas, dispatch } = createFakeCanvas()
    const onRestored = vi.fn()
    const reload = vi.fn()

    installContextRecovery(canvas, { onLost: vi.fn(), onRestored }, { reload })
    dispatch('webglcontextrestored')

    expect(onRestored).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
  })

  it('recarga como último recurso si onRestored lanza', () => {
    const { canvas, dispatch } = createFakeCanvas()
    const reload = vi.fn()
    const warn = vi.fn()
    const onRestored = vi.fn(() => {
      throw new Error('reconstrucción no viable')
    })

    installContextRecovery(canvas, { onLost: vi.fn(), onRestored }, { reload, warn })
    // No debe propagar el error: lo captura y recarga.
    expect(() => dispatch('webglcontextrestored')).not.toThrow()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('registra exactamente un listener por tipo (no los duplica)', () => {
    const { canvas, count } = createFakeCanvas()

    installContextRecovery(canvas, { onLost: vi.fn(), onRestored: vi.fn() })

    expect(count('webglcontextlost')).toBe(1)
    expect(count('webglcontextrestored')).toBe(1)
  })

  it('uninstall retira ambos listeners', () => {
    const { canvas, dispatch, count } = createFakeCanvas()
    const onLost = vi.fn()
    const onRestored = vi.fn()

    const recovery = installContextRecovery(canvas, { onLost, onRestored })
    recovery.uninstall()

    expect(count('webglcontextlost')).toBe(0)
    expect(count('webglcontextrestored')).toBe(0)

    // Ya retirados: despachar no invoca nada.
    dispatch('webglcontextlost')
    dispatch('webglcontextrestored')
    expect(onLost).not.toHaveBeenCalled()
    expect(onRestored).not.toHaveBeenCalled()
  })
})
