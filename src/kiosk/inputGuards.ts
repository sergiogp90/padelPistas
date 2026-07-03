// Bloquea las interacciones que no tienen sentido en una pantalla desatendida:
// el menú contextual (clic derecho / pulsación larga) y el zoom por gesto
// (Ctrl+rueda en escritorio, pellizco en táctiles). La selección de texto y el
// scroll/zoom táctil se desactivan por CSS (`user-select`/`touch-action` en
// `kiosk.css`); aquí se cubren los gestos que el CSS no puede frenar.

export interface InputGuards {
  /** Retira todos los listeners instalados. */
  stop(): void
}

/**
 * Instala los guardas de entrada sobre `target`. Devuelve un manejador para
 * retirarlos. Solo previene comportamientos; no interfiere con eventos que no
 * sean los indicados.
 */
export function installInputGuards(
  target: HTMLElement = document.body,
): InputGuards {
  const prevent = (event: Event): void => event.preventDefault()

  // Zoom con Ctrl+rueda: solo se bloquea cuando `ctrlKey` está pulsado, para no
  // interferir con un eventual scroll normal.
  const onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey) event.preventDefault()
  }

  target.addEventListener('contextmenu', prevent)
  target.addEventListener('wheel', onWheel, { passive: false })
  // `gesturestart` es propio de WebKit (pellizco para zoom en Safari/iOS).
  target.addEventListener('gesturestart', prevent)

  return {
    stop() {
      target.removeEventListener('contextmenu', prevent)
      target.removeEventListener('wheel', onWheel)
      target.removeEventListener('gesturestart', prevent)
    },
  }
}
