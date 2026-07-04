import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startKioskMode, KIOSK_ACTIVE_CLASS } from './index'

describe('startKioskMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.className = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marca el body como kiosko activo y arma sus piezas', () => {
    const kiosk = startKioskMode({ fullscreenOnGesture: false })

    expect(document.body.classList.contains(KIOSK_ACTIVE_CLASS)).toBe(true)

    // El menú contextual queda bloqueado (guardas de entrada montados).
    const event = new Event('contextmenu', { cancelable: true })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    kiosk.stop()
  })

  it('stop() revierte la clase del body y los guardas', () => {
    const kiosk = startKioskMode({ fullscreenOnGesture: false })
    kiosk.stop()

    expect(document.body.classList.contains(KIOSK_ACTIVE_CLASS)).toBe(false)

    const event = new Event('contextmenu', { cancelable: true })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('no lanza aunque el navegador carezca de Wake Lock y Fullscreen', () => {
    // jsdom no implementa wakeLock ni fullscreen: es el caso de degradación.
    expect(() => startKioskMode().stop()).not.toThrow()
  })
})
