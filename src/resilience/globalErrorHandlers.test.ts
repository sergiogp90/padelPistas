import { describe, it, expect, vi } from 'vitest'
import {
  installGlobalErrorHandlers,
  type ErrorEventTarget,
} from './globalErrorHandlers'

/**
 * Doble del objeto global (window): registra los listeners y permite despacharlos
 * a mano con un `event` arbitrario, además de contar cuántos hay vivos por tipo
 * (para comprobar que no se acumulan ni quedan colgados tras `uninstall`).
 */
function createFakeTarget() {
  const listeners = new Map<string, Set<(event: Event) => void>>()
  const target: ErrorEventTarget = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
  }
  const dispatch = (type: string, event: unknown) => {
    listeners.get(type)?.forEach((l) => l(event as Event))
  }
  const count = (type: string) => listeners.get(type)?.size ?? 0
  return { target, dispatch, count }
}

describe('installGlobalErrorHandlers', () => {
  it('captura excepciones no controladas y extrae el mensaje del Error', () => {
    const { target, dispatch } = createFakeTarget()
    const onError = vi.fn()
    const warn = vi.fn()

    installGlobalErrorHandlers({ target, onError, warn })
    dispatch('error', { error: new Error('boom'), message: 'boom' })

    const captured = { kind: 'error', message: 'boom', cause: expect.any(Error) }
    expect(onError).toHaveBeenCalledWith(expect.objectContaining(captured))
    expect(warn).toHaveBeenCalledWith(expect.objectContaining(captured))
  })

  it('usa el message del evento si no hay objeto error', () => {
    const { target, dispatch } = createFakeTarget()
    const onError = vi.fn()

    installGlobalErrorHandlers({ target, onError, warn: vi.fn() })
    dispatch('error', { message: 'script error' })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', message: 'script error' }),
    )
  })

  it('captura promesas rechazadas y usa su reason', () => {
    const { target, dispatch } = createFakeTarget()
    const onError = vi.fn()

    installGlobalErrorHandlers({ target, onError, warn: vi.fn() })
    dispatch('unhandledrejection', { reason: new Error('rechazo') })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'unhandledrejection', message: 'rechazo' }),
    )
  })

  it('da un mensaje genérico ante un rechazo sin mensaje legible', () => {
    const { target, dispatch } = createFakeTarget()
    const onError = vi.fn()

    installGlobalErrorHandlers({ target, onError, warn: vi.fn() })
    dispatch('unhandledrejection', { reason: null })

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error desconocido' }),
    )
  })

  it('no rompe la app si onError lanza', () => {
    const { target, dispatch } = createFakeTarget()
    const onError = vi.fn(() => {
      throw new Error('overlay roto')
    })

    installGlobalErrorHandlers({ target, onError, warn: vi.fn() })
    // Un fallo del manejador no debe propagarse.
    expect(() => dispatch('error', { message: 'x' })).not.toThrow()
  })

  it('registra exactamente un listener por tipo (no los duplica)', () => {
    const { target, count } = createFakeTarget()

    installGlobalErrorHandlers({ target, warn: vi.fn() })

    expect(count('error')).toBe(1)
    expect(count('unhandledrejection')).toBe(1)
  })

  it('uninstall retira ambos listeners', () => {
    const { target, dispatch, count } = createFakeTarget()
    const onError = vi.fn()

    const handlers = installGlobalErrorHandlers({ target, onError, warn: vi.fn() })
    handlers.uninstall()

    expect(count('error')).toBe(0)
    expect(count('unhandledrejection')).toBe(0)

    dispatch('error', { message: 'x' })
    dispatch('unhandledrejection', { reason: 'y' })
    expect(onError).not.toHaveBeenCalled()
  })
})
