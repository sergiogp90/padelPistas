// Modo kiosko: presenta la app como una pantalla limpia y estable para una TV
// desatendida en un club. Orquesta las piezas independientes de esta carpeta:
//
//   - cursorAutoHide  oculta el cursor tras la inactividad
//   - inputGuards     bloquea menú contextual y zoom por gesto
//   - wakeLock        impide que la pantalla entre en reposo
//   - fullscreen      entra a pantalla completa con el primer gesto
//
// Cada pieza degrada con elegancia si su API no está disponible, así que
// activar el kiosko es seguro en cualquier navegador (Chrome/Chromium es el de
// referencia para TV). El resto de reglas visuales (sin selección, sin
// scroll/zoom táctil, cursor oculto) viven en `kiosk.css` bajo `.kiosk-active`.

import './kiosk.css'
import { createCursorAutoHide } from './cursorAutoHide'
import { installInputGuards } from './inputGuards'
import { createWakeLockManager } from './wakeLock'
import { enableFullscreenOnGesture } from './fullscreen'

/** Clase que activa las reglas de `kiosk.css` sobre el <body>. */
export const KIOSK_ACTIVE_CLASS = 'kiosk-active'

export interface KioskOptions {
  /** Inactividad (ms) tras la que se oculta el cursor. */
  cursorHideDelayMs?: number
  /**
   * Si es `false`, no arma la entrada automática a pantalla completa con el
   * primer gesto (útil en desarrollo). Por defecto está activa.
   */
  fullscreenOnGesture?: boolean
}

export interface KioskMode {
  /** Desactiva el modo kiosko y revierte todo lo que instaló. */
  stop(): void
}

/**
 * Arranca el modo kiosko. Devuelve un manejador `stop()` que revierte todos los
 * efectos (clases, listeners y wake lock), pensado sobre todo para tests y para
 * un eventual botón de salida.
 */
export function startKioskMode(options: KioskOptions = {}): KioskMode {
  document.body.classList.add(KIOSK_ACTIVE_CLASS)

  const cursor = createCursorAutoHide(document.body, {
    delayMs: options.cursorHideDelayMs,
  })
  const guards = installInputGuards(document.body)
  const wakeLock = createWakeLockManager()
  const fullscreen =
    options.fullscreenOnGesture === false ? undefined : enableFullscreenOnGesture()

  return {
    stop() {
      fullscreen?.stop()
      wakeLock.stop()
      guards.stop()
      cursor.stop()
      document.body.classList.remove(KIOSK_ACTIVE_CLASS)
    },
  }
}
