import { describe, it, expect, vi } from 'vitest'
import { createWakeLockManager } from './wakeLock'

/** Deja correr las microtareas pendientes (las promesas de `acquire`). */
const flush = () => Promise.resolve()

/** Sentinel de prueba: registra las liberaciones y permite emitir `release`. */
function createFakeSentinel() {
  let released = false
  let onRelease: (() => void) | undefined
  return {
    sentinel: {
      release: vi.fn(async () => {
        released = true
      }),
      addEventListener: (_type: 'release', listener: () => void) => {
        onRelease = listener
      },
    },
    emitRelease: () => onRelease?.(),
    isReleased: () => released,
  }
}

/** Documento de prueba con `visibilityState` controlable y despacho manual. */
function createFakeDoc(initial: DocumentVisibilityState = 'visible') {
  const listeners = new Map<string, Set<EventListener>>()
  const doc = {
    visibilityState: initial,
    addEventListener(type: string, cb: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(cb)
    },
    removeEventListener(type: string, cb: EventListener) {
      listeners.get(type)?.delete(cb)
    },
    dispatch(type: string) {
      listeners.get(type)?.forEach((l) => l(new Event(type)))
    },
    setVisibility(state: DocumentVisibilityState) {
      doc.visibilityState = state
    },
  }
  return doc
}

describe('createWakeLockManager', () => {
  it('adquiere el lock al arrancar', async () => {
    const { sentinel } = createFakeSentinel()
    const request = vi.fn(async () => sentinel)
    const doc = createFakeDoc('visible')

    createWakeLockManager({ wakeLock: { request } }, doc as unknown as Document)
    await flush()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('re-adquiere el lock al volver a visible tras liberarse', async () => {
    const a = createFakeSentinel()
    const b = createFakeSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(a.sentinel)
      .mockResolvedValueOnce(b.sentinel)
    const doc = createFakeDoc('visible')

    createWakeLockManager({ wakeLock: { request } }, doc as unknown as Document)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)

    // El sistema oculta la pestaña y libera el lock.
    doc.setVisibility('hidden')
    a.emitRelease()

    // Al volver a visible, se vuelve a pedir.
    doc.setVisibility('visible')
    doc.dispatch('visibilitychange')
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('no vuelve a pedir el lock en un visibilitychange a hidden', async () => {
    const { sentinel } = createFakeSentinel()
    const request = vi.fn(async () => sentinel)
    const doc = createFakeDoc('visible')

    createWakeLockManager({ wakeLock: { request } }, doc as unknown as Document)
    await flush()

    doc.setVisibility('hidden')
    doc.dispatch('visibilitychange')
    await flush()

    // Solo la adquisición inicial: ocultarse no dispara una nueva petición.
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('stop() libera el lock y deja de escuchar visibilitychange', async () => {
    const { sentinel, isReleased } = createFakeSentinel()
    const request = vi.fn(async () => sentinel)
    const doc = createFakeDoc('visible')

    const manager = createWakeLockManager(
      { wakeLock: { request } },
      doc as unknown as Document,
    )
    await flush()

    manager.stop()
    await flush()
    expect(isReleased()).toBe(true)

    doc.dispatch('visibilitychange')
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('degrada con elegancia si el navegador no soporta la Wake Lock API', () => {
    const doc = createFakeDoc('visible')
    // Sin `wakeLock`: no debe lanzar ni al crear ni al parar.
    expect(() => {
      const manager = createWakeLockManager({}, doc as unknown as Document)
      manager.stop()
    }).not.toThrow()
  })
})
