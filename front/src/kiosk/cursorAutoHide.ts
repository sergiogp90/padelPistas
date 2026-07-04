// Oculta el cursor tras unos segundos de inactividad y lo vuelve a mostrar en
// cuanto se mueve el ratón. En una pantalla desatendida el puntero se queda
// clavado en medio de la imagen; esto lo hace desaparecer sin necesidad de
// tocar nada, y reaparece solo si un operador mueve el ratón.
//
// No cambia el estilo directamente: alterna una clase en el elemento objetivo
// (`kiosk-cursor-hidden`), cuyo `cursor: none` vive en `kiosk.css`.

/** Clase que aplica `cursor: none` (definida en `kiosk.css`). */
export const CURSOR_HIDDEN_CLASS = 'kiosk-cursor-hidden'

/** Inactividad por defecto (ms) tras la que se oculta el cursor. */
const DEFAULT_DELAY_MS = 3000

export interface CursorAutoHideOptions {
  /** Milisegundos de inactividad tras los que se oculta el cursor. */
  delayMs?: number
}

export interface CursorAutoHide {
  /** Cancela el temporizador, retira el listener y vuelve a mostrar el cursor. */
  stop(): void
}

/**
 * Arranca el ocultado automático del cursor sobre `target`. El cursor se oculta
 * pasados `delayMs` sin movimiento (empezando ya en el montaje, para que
 * desaparezca aunque nadie toque el ratón) y reaparece con cada `mousemove`.
 */
export function createCursorAutoHide(
  target: HTMLElement = document.body,
  options: CursorAutoHideOptions = {},
): CursorAutoHide {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  let timer: ReturnType<typeof setTimeout> | undefined

  const hide = (): void => {
    target.classList.add(CURSOR_HIDDEN_CLASS)
  }

  // Muestra el cursor y reinicia la cuenta atrás para volver a ocultarlo.
  const show = (): void => {
    target.classList.remove(CURSOR_HIDDEN_CLASS)
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(hide, delayMs)
  }

  target.addEventListener('mousemove', show)
  show()

  return {
    stop() {
      target.removeEventListener('mousemove', show)
      if (timer !== undefined) clearTimeout(timer)
      target.classList.remove(CURSOR_HIDDEN_CLASS)
    },
  }
}
