import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRenderWatchdog } from './renderWatchdog'

/**
 * Tests del watchdog del bucle de render. Comprueban que deja en paz un bucle que
 * pinta, que reinicia uno atascado, que recarga tras agotar los reintentos, que
 * avisa de la recuperación y que se pausa/reanuda con la visibilidad de la página.
 *
 * El tiempo se controla en dos frentes acompasados: los temporizadores falsos de
 * vitest (para `setInterval`) y un reloj `now()` inyectado que avanza en lockstep
 * con cada comprobación. La visibilidad se maneja con un doble del `document`.
 */

// Doble mínimo de Document: visibilidad mutable y un único listener de
// `visibilitychange` que podemos disparar a mano.
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

const TIMEOUT_MS = 3000
const CHECK_MS = 1000

function setup(
  opts: {
    visibility?: DocumentVisibilityState
    maxRestarts?: number
  } = {},
) {
  const state = { clock: 0, frames: 0 }
  const restart = vi.fn()
  const reload = vi.fn()
  const onStall = vi.fn()
  const onRecover = vi.fn()
  const ctx = makeDoc(opts.visibility)

  const wd = createRenderWatchdog({
    getFrameCount: () => state.frames,
    restart,
    reload,
    onStall,
    onRecover,
    timeoutMs: TIMEOUT_MS,
    checkIntervalMs: CHECK_MS,
    maxRestarts: opts.maxRestarts ?? 2,
    restartWindowMs: 60_000,
    now: () => state.clock,
    doc: ctx.doc,
    warn: vi.fn(),
  })

  // Avanza `steps` comprobaciones. Con `paint`, incrementa el contador de
  // fotogramas antes de cada comprobación (simula un bucle vivo); sin él, el
  // contador queda congelado (simula un atasco).
  function tick(steps: number, { paint = false } = {}) {
    for (let i = 0; i < steps; i++) {
      if (paint) state.frames++
      state.clock += CHECK_MS
      vi.advanceTimersByTime(CHECK_MS)
    }
  }

  return { wd, state, restart, reload, onStall, onRecover, ctx, tick }
}

describe('createRenderWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no reinicia mientras se pintan fotogramas', () => {
    const { wd, restart, reload, tick } = setup()

    tick(10, { paint: true })

    expect(restart).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    wd.stop()
  })

  it('reinicia el bucle si no se pinta durante más del timeout', () => {
    const { wd, restart, reload, onStall, tick } = setup()

    tick(3) // 3s sin pintar == TIMEOUT_MS

    expect(restart).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    expect(onStall).toHaveBeenCalledWith(
      expect.objectContaining({ reloading: false, restarts: 1 }),
    )
    wd.stop()
  })

  it('recarga tras agotar los reinicios permitidos', () => {
    const { wd, restart, reload, onStall, tick } = setup({ maxRestarts: 2 })

    tick(9) // estancado: reinicio a 3s, a 6s y recarga a 9s

    expect(restart).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(onStall).toHaveBeenLastCalledWith(
      expect.objectContaining({ reloading: true }),
    )
    wd.stop()
  })

  it('avisa de la recuperación cuando el bucle vuelve a pintar', () => {
    const { wd, onRecover, tick } = setup()

    tick(3) // se atasca y reinicia
    expect(onRecover).not.toHaveBeenCalled()

    tick(1, { paint: true }) // vuelve a avanzar

    expect(onRecover).toHaveBeenCalledTimes(1)
    wd.stop()
  })

  it('se pausa mientras la página está oculta y reanuda al volver', () => {
    const { wd, restart, ctx, tick } = setup()

    // Con la página oculta `requestAnimationFrame` no corre: el contador se
    // congela, pero eso no debe interpretarse como un atasco.
    ctx.setVisibility('hidden')
    tick(10)
    expect(restart).not.toHaveBeenCalled()

    // Al volver a ser visible se rearma con una referencia fresca y vuelve a
    // vigilar; un atasco real a partir de ahí sí dispara el reinicio.
    ctx.setVisibility('visible')
    tick(3)
    expect(restart).toHaveBeenCalledTimes(1)
    wd.stop()
  })

  it('no arranca la vigilancia si la página nace oculta', () => {
    const { wd, restart, ctx, tick } = setup({ visibility: 'hidden' })

    tick(10)
    expect(restart).not.toHaveBeenCalled()

    ctx.setVisibility('visible')
    tick(3)
    expect(restart).toHaveBeenCalledTimes(1)
    wd.stop()
  })

  it('stop() detiene la vigilancia y retira el listener de visibilidad', () => {
    const { wd, restart, ctx, tick } = setup()

    wd.stop()
    expect(ctx.hasListener()).toBe(false)

    tick(10)
    expect(restart).not.toHaveBeenCalled()
  })
})
