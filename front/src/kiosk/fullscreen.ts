// Pantalla completa mediante la Fullscreen API. Los navegadores solo permiten
// entrar en fullscreen dentro de un gesto del usuario, así que no se puede pedir
// al cargar: se arma un disparador que entra en pantalla completa con la primera
// interacción (un clic o una tecla), suficiente para arrancar el kiosko.
//
// Se definen tipos laxos propios para tolerar el prefijo `webkit` y para poder
// degradar con elegancia donde la API no exista.

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void
}

interface FullscreenDocument {
  fullscreenElement?: Element | null
  fullscreenEnabled?: boolean
  addEventListener: Document['addEventListener']
  removeEventListener: Document['removeEventListener']
}

/**
 * Pide pantalla completa para `element`. Nunca lanza: si la API no existe o el
 * navegador la deniega, resuelve sin efecto (degradación elegante).
 */
export function requestFullscreen(
  element: FullscreenElement = document.documentElement,
): Promise<void> {
  const request =
    element.requestFullscreen ?? element.webkitRequestFullscreen
  if (!request) return Promise.resolve()
  try {
    const result = request.call(element)
    return result instanceof Promise ? result.catch(() => {}) : Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}

export interface FullscreenTrigger {
  /** Retira el disparador (p. ej. si nunca llega a usarse). */
  stop(): void
}

/**
 * Arma la entrada en pantalla completa con el primer gesto del usuario
 * (`pointerdown` o `keydown`). Se auto-desarma tras el primer disparo. Si el
 * documento ya no admite fullscreen (`fullscreenEnabled === false`), no arma
 * nada y devuelve un manejador inerte.
 */
export function enableFullscreenOnGesture(
  element: FullscreenElement = document.documentElement,
  doc: FullscreenDocument = document,
): FullscreenTrigger {
  if (doc.fullscreenEnabled === false) return { stop() {} }

  const events = ['pointerdown', 'keydown'] as const

  const stop = (): void => {
    for (const type of events) doc.removeEventListener(type, trigger)
  }

  const trigger = (): void => {
    // Evita repetir la petición si ya estamos en pantalla completa.
    if (!doc.fullscreenElement) void requestFullscreen(element)
    stop()
  }

  for (const type of events) doc.addEventListener(type, trigger)

  return { stop }
}
