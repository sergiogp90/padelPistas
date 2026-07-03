import { describe, it, expect, vi } from 'vitest'
import { installVisibilityPause } from './visibilityPause'

/**
 * Tests del ayudante de pausa por visibilidad. Con un doble del `document` (igual
 * que `viewRotation`) comprueban que avisa al ocultarse y al volver, que expone el
 * estado actual y que `uninstall` retira el listener.
 */

// Doble mínimo de Document: visibilidad mutable y un único listener de
// `visibilitychange` que podemos disparar a mano al cambiar el estado.
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

describe('installVisibilityPause', () => {
  it('no dispara ningún callback al instalarse (solo reacciona a cambios)', () => {
    const ctx = makeDoc()
    const onHidden = vi.fn()
    const onVisible = vi.fn()

    installVisibilityPause({ onHidden, onVisible }, { doc: ctx.doc })

    expect(onHidden).not.toHaveBeenCalled()
    expect(onVisible).not.toHaveBeenCalled()
  })

  it('llama a onHidden al ocultarse y a onVisible al volver', () => {
    const ctx = makeDoc()
    const onHidden = vi.fn()
    const onVisible = vi.fn()

    installVisibilityPause({ onHidden, onVisible }, { doc: ctx.doc })

    ctx.setVisibility('hidden')
    expect(onHidden).toHaveBeenCalledTimes(1)
    expect(onVisible).not.toHaveBeenCalled()

    ctx.setVisibility('visible')
    expect(onVisible).toHaveBeenCalledTimes(1)
    expect(onHidden).toHaveBeenCalledTimes(1)
  })

  it('expone el estado de visibilidad actual', () => {
    const ctx = makeDoc('visible')
    const pause = installVisibilityPause(
      { onHidden: vi.fn(), onVisible: vi.fn() },
      { doc: ctx.doc },
    )

    expect(pause.hidden).toBe(false)
    ctx.setVisibility('hidden')
    expect(pause.hidden).toBe(true)
  })

  it('uninstall retira el listener y deja de avisar', () => {
    const ctx = makeDoc()
    const onHidden = vi.fn()
    const onVisible = vi.fn()

    const pause = installVisibilityPause({ onHidden, onVisible }, { doc: ctx.doc })
    pause.uninstall()

    expect(ctx.hasListener()).toBe(false)
    ctx.setVisibility('hidden')
    expect(onHidden).not.toHaveBeenCalled()
  })
})
