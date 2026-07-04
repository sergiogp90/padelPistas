import { describe, it, expect, vi } from 'vitest'
import { requestFullscreen, enableFullscreenOnGesture } from './fullscreen'

/** Elemento de prueba con `requestFullscreen` mockeable. */
function createFakeElement(withApi = true) {
  const requestFullscreen = vi.fn(async () => {})
  // Objeto laxo (no un HTMLElement real): jsdom no implementa la Fullscreen API,
  // así que la simulamos y, para el caso de degradación, la dejamos sin definir.
  const el = { requestFullscreen: withApi ? requestFullscreen : undefined }
  return { el: el as unknown as HTMLElement, requestFullscreen }
}

/** Documento de prueba con estado de fullscreen y despacho manual. */
function createFakeDoc(
  opts: { fullscreenEnabled?: boolean; fullscreenElement?: Element | null } = {},
) {
  const listeners = new Map<string, Set<EventListener>>()
  return {
    fullscreenEnabled: opts.fullscreenEnabled ?? true,
    fullscreenElement: opts.fullscreenElement ?? null,
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
  }
}

describe('requestFullscreen', () => {
  it('llama a la API del elemento', async () => {
    const { el, requestFullscreen: req } = createFakeElement()
    await requestFullscreen(el)
    expect(req).toHaveBeenCalledTimes(1)
  })

  it('degrada con elegancia si el elemento no soporta la API', async () => {
    const { el, requestFullscreen: req } = createFakeElement(false)
    await expect(requestFullscreen(el)).resolves.toBeUndefined()
    expect(req).not.toHaveBeenCalled()
  })
})

describe('enableFullscreenOnGesture', () => {
  it('entra en fullscreen con el primer gesto y luego se desarma', () => {
    const { el, requestFullscreen: req } = createFakeElement()
    const doc = createFakeDoc()

    enableFullscreenOnGesture(el, doc as unknown as Document)

    doc.dispatch('pointerdown')
    expect(req).toHaveBeenCalledTimes(1)

    // Auto-desarmado: un segundo gesto ya no vuelve a pedirlo.
    doc.dispatch('pointerdown')
    doc.dispatch('keydown')
    expect(req).toHaveBeenCalledTimes(1)
  })

  it('no hace nada si el documento no admite fullscreen', () => {
    const { el, requestFullscreen: req } = createFakeElement()
    const doc = createFakeDoc({ fullscreenEnabled: false })

    enableFullscreenOnGesture(el, doc as unknown as Document)
    doc.dispatch('pointerdown')
    expect(req).not.toHaveBeenCalled()
  })

  it('no vuelve a pedir fullscreen si ya estamos en pantalla completa', () => {
    const { el, requestFullscreen: req } = createFakeElement()
    const doc = createFakeDoc({ fullscreenElement: document.createElement('div') })

    enableFullscreenOnGesture(el, doc as unknown as Document)
    doc.dispatch('pointerdown')
    expect(req).not.toHaveBeenCalled()
  })

  it('stop() retira los disparadores', () => {
    const { el, requestFullscreen: req } = createFakeElement()
    const doc = createFakeDoc()

    const { stop } = enableFullscreenOnGesture(el, doc as unknown as Document)
    stop()

    doc.dispatch('pointerdown')
    expect(req).not.toHaveBeenCalled()
  })
})
