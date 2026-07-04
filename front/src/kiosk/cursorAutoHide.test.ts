import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createCursorAutoHide, CURSOR_HIDDEN_CLASS } from './cursorAutoHide'

describe('createCursorAutoHide', () => {
  let target: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    target = document.createElement('div')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('oculta el cursor tras la inactividad, sin necesidad de mover el ratón', () => {
    createCursorAutoHide(target, { delayMs: 1000 })

    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true)
  })

  it('muestra el cursor y reinicia la cuenta atrás con cada mousemove', () => {
    createCursorAutoHide(target, { delayMs: 1000 })
    vi.advanceTimersByTime(1000)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true)

    target.dispatchEvent(new MouseEvent('mousemove'))
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false)

    // Un movimiento a mitad de la cuenta la reinicia: no se oculta a los 1000ms
    // desde el primer movimiento, sino 1000ms desde el último.
    vi.advanceTimersByTime(500)
    target.dispatchEvent(new MouseEvent('mousemove'))
    vi.advanceTimersByTime(500)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false)
    vi.advanceTimersByTime(500)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true)
  })

  it('stop() cancela el temporizador, retira el listener y muestra el cursor', () => {
    const { stop } = createCursorAutoHide(target, { delayMs: 1000 })
    vi.advanceTimersByTime(1000)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(true)

    stop()
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false)

    // Tras stop(), ni el movimiento ni el paso del tiempo tocan la clase.
    target.dispatchEvent(new MouseEvent('mousemove'))
    vi.advanceTimersByTime(5000)
    expect(target.classList.contains(CURSOR_HIDDEN_CLASS)).toBe(false)
  })
})
