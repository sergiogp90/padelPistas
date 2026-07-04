// Watchdog del bucle de render.
//
// El bucle de dibujado (`requestAnimationFrame`) es el corazón de la app: si se
// detiene, la TV se queda con la última imagen congelada sin que nadie lo note.
// Ni la recuperación de contexto WebGL ni la captura global de errores cubren
// todos los casos (un cuelgue silencioso, un `rAF` que deja de dispararse, una
// excepción que impide avanzar el fotograma…). Este watchdog es la red de
// seguridad final: vigila que se PINTEN fotogramas y, si dejan de avanzar,
// reanima el bucle y, en última instancia, recarga la página.
//
// Cómo lo detecta: el renderer expone un contador de fotogramas que incrementa
// tras pintar cada frame. El watchdog lo consulta periódicamente (`setInterval`);
// si no ha avanzado durante `timeoutMs`, da el bucle por detenido y actúa.
//
// Escalada de recuperación:
//   1. Reiniciar el bucle (`restart`). Suele bastar ante un tropiezo puntual.
//   2. Si tras `maxRestarts` reinicios dentro de `restartWindowMs` sigue sin
//      pintar, recargar la página (`reload`) como recuperación dura.
//
// Como con `requestAnimationFrame` el navegador congela el bucle cuando la página
// está oculta (otra pestaña, TV en reposo), el watchdog se pausa mientras el
// documento no es visible para no confundir esa pausa legítima con un atasco.
//
// Todas las dependencias (contador, reinicio, recarga, reloj, documento) se
// inyectan para poder probarlo aislado con temporizadores falsos, igual que
// `viewRotation` y `contextRecovery`.

import {
  MAX_RESTARTS,
  RESTART_WINDOW_MS,
  STALL_TIMEOUT_MS,
  WATCHDOG_CHECK_INTERVAL_MS,
} from './config'

/** Información del atasco detectado, para registro y overlay. */
export interface RenderStall {
  /** ms transcurridos sin que avanzara el contador de fotogramas. */
  stalledForMs: number
  /** Nº de reinicios ya realizados dentro de la ventana (incluido este). */
  restarts: number
  /** `true` si se va a recargar la página en lugar de reintentar. */
  reloading: boolean
}

export interface RenderWatchdogOptions {
  /** Lee el contador de fotogramas del renderer (crece al pintar cada frame). */
  getFrameCount: () => number
  /** Reinicia el bucle de render (p. ej. `renderer.restart()`). */
  restart: () => void
  /** Recarga de último recurso. Por defecto recarga la página. */
  reload?: () => void
  /** Se invoca al detectar un atasco (antes de reiniciar/recargar): avisa. */
  onStall?: (stall: RenderStall) => void
  /** Se invoca cuando el bucle vuelve a pintar tras un atasco: retira el aviso. */
  onRecover?: () => void
  /** ms sin nuevo fotograma para dar el bucle por detenido. Por defecto `STALL_TIMEOUT_MS`. */
  timeoutMs?: number
  /** Cada cuánto comprobar el contador. Por defecto `WATCHDOG_CHECK_INTERVAL_MS`. */
  checkIntervalMs?: number
  /** Reinicios permitidos por ventana antes de recargar. Por defecto `MAX_RESTARTS`. */
  maxRestarts?: number
  /** Ventana deslizante (ms) para contar reinicios. Por defecto `RESTART_WINDOW_MS`. */
  restartWindowMs?: number
  /** Reloj para medir tiempos. Por defecto `Date.now` (inyectable en tests). */
  now?: () => number
  /** Documento cuya visibilidad pausa/reanuda el watchdog (inyectable en tests). */
  doc?: Document
  /** Registro de eventos del watchdog. Por defecto `console.warn`. */
  warn?: (message: string) => void
}

export interface RenderWatchdog {
  /** Detiene la vigilancia y retira el listener de visibilidad. */
  stop(): void
}

/**
 * Arranca el watchdog del bucle de render. Comprueba cada `checkIntervalMs` que
 * el contador de fotogramas avanza; si se estanca `timeoutMs`, reinicia el bucle
 * y, tras `maxRestarts` reinicios dentro de `restartWindowMs`, recarga la página.
 *
 * Se pausa mientras el documento está oculto (donde `requestAnimationFrame` no
 * corre) y reanuda —tomando una nueva referencia del contador— al volver a ser
 * visible, para no interpretar esa pausa como un atasco.
 */
export function createRenderWatchdog(
  options: RenderWatchdogOptions,
): RenderWatchdog {
  const { getFrameCount, restart } = options
  const reload = options.reload ?? (() => window.location.reload())
  const timeoutMs = options.timeoutMs ?? STALL_TIMEOUT_MS
  const checkIntervalMs = options.checkIntervalMs ?? WATCHDOG_CHECK_INTERVAL_MS
  const maxRestarts = options.maxRestarts ?? MAX_RESTARTS
  const restartWindowMs = options.restartWindowMs ?? RESTART_WINDOW_MS
  const now = options.now ?? (() => Date.now())
  const doc = options.doc ?? document
  const warn = options.warn ?? ((message: string) => console.warn(message))

  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  // Último valor observado del contador y momento en que avanzó por última vez.
  let lastCount = 0
  let lastProgressAt = 0
  // Marcas de tiempo de los reinicios recientes (ventana deslizante).
  let restarts: number[] = []
  // `true` mientras el bucle está atascado, para emitir `onRecover` una sola vez.
  let stalled = false

  const clear = (): void => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  const check = (): void => {
    const count = getFrameCount()
    const t = now()

    // El bucle avanza con normalidad: actualiza la referencia y, si venía de un
    // atasco, avisa de la recuperación.
    if (count !== lastCount) {
      lastCount = count
      lastProgressAt = t
      if (stalled) {
        stalled = false
        options.onRecover?.()
      }
      return
    }

    // Sin nuevos fotogramas pero aún dentro del margen de tolerancia: espera.
    const stalledForMs = t - lastProgressAt
    if (stalledForMs < timeoutMs) return

    // Atascado más de lo tolerable. Cuenta los reinicios recientes (descartando
    // los que caen fuera de la ventana) para decidir entre reintentar o recargar.
    stalled = true
    restarts = restarts.filter((at) => t - at < restartWindowMs)

    if (restarts.length >= maxRestarts) {
      // Los reinicios no han bastado: recarga como recuperación dura.
      options.onStall?.({ stalledForMs, restarts: restarts.length, reloading: true })
      warn('Watchdog: demasiados reinicios sin éxito; recargando la página')
      reload()
      return
    }

    restarts.push(t)
    options.onStall?.({ stalledForMs, restarts: restarts.length, reloading: false })
    warn(`Watchdog: bucle detenido ${stalledForMs}ms; reiniciando (intento ${restarts.length})`)
    restart()
    // Da al bucle un margen completo (`timeoutMs`) para producir un fotograma
    // antes de volver a juzgarlo tras este reinicio.
    lastProgressAt = t
  }

  // (Re)arma la vigilancia tomando una referencia fresca del contador, de modo
  // que un salto del contador por el tiempo en pausa no se lea como progreso ni
  // como atasco.
  const arm = (): void => {
    clear()
    lastCount = getFrameCount()
    lastProgressAt = now()
    stalled = false
    timer = setInterval(check, checkIntervalMs)
  }

  const onVisibilityChange = (): void => {
    if (stopped) return
    // Con la página oculta `requestAnimationFrame` no corre: pausa el watchdog
    // para no confundir esa pausa con un cuelgue.
    if (doc.visibilityState === 'hidden') clear()
    else arm()
  }

  doc.addEventListener('visibilitychange', onVisibilityChange)
  // Arranca ya salvo que la página nazca oculta; en ese caso espera al primer
  // `visibilitychange` a `visible`.
  if (doc.visibilityState !== 'hidden') arm()

  return {
    stop() {
      stopped = true
      clear()
      doc.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
