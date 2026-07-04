// Recuperación ante pérdida del contexto WebGL.
//
// La app usa un ÚNICO `WebGLRenderer`/canvas para todas las pistas (ver
// ADR 0001). Si el navegador pierde el contexto WebGL —driver, suspensión de la
// TV, presión de memoria en la GPU…— el canvas se queda congelado hasta recargar,
// algo inaceptable en un panel desatendido. El navegador avisa con dos eventos en
// el canvas: `webglcontextlost` (al perderlo) y `webglcontextrestored` (cuando
// vuelve a estar disponible).
//
// Detalle CLAVE: hay que llamar a `preventDefault()` en `webglcontextlost`. Sin
// eso el navegador da el contexto por perdido de forma definitiva y NO emite
// `webglcontextrestored`, con lo que la recuperación automática sería imposible.
//
// Este módulo solo cablea esos dos eventos e invoca sendos callbacks, sin tocar
// Three.js ni el DOM de la interfaz. Los efectos (parar/reanudar el bucle,
// avisar, recargar) se inyectan, de modo que la máquina se prueba aislada —como
// `wakeLock` o `viewRotation`— con un canvas de doble.

/**
 * Contrato mínimo del canvas: solo necesitamos suscribir y retirar los dos
 * eventos de contexto. Se define estructuralmente (en vez de exigir un
 * `HTMLCanvasElement`) para poder inyectar dobles en los tests.
 */
export interface ContextEventTarget {
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

export interface ContextRecoveryHandlers {
  /** Contexto perdido: detén el bucle de render y avisa (bloque discreto). */
  onLost(): void
  /**
   * Contexto restaurado: reconstruye lo necesario y reanuda el bucle. Si lanza,
   * se considera que la recuperación no es viable y se recarga la página como
   * último recurso.
   */
  onRestored(): void
}

export interface ContextRecoveryOptions {
  /** Último recurso si `onRestored` falla. Por defecto recarga la página. */
  reload?: () => void
  /** Registro de errores de `onRestored`. Por defecto `console.error`. */
  warn?: (error: unknown) => void
}

export interface ContextRecovery {
  /** Retira ambos listeners (evita fugas y duplicados). */
  uninstall(): void
}

/**
 * Cablea la recuperación de contexto WebGL sobre `canvas`. Devuelve un manejador
 * para retirar los listeners.
 *
 * - Al perderse el contexto: `preventDefault()` (imprescindible para que el
 *   navegador vuelva a emitir la restauración) y se invoca `onLost`.
 * - Al restaurarse: se invoca `onRestored`; si lanza, se avisa y se recarga la
 *   página como último recurso, de modo que el panel nunca quede congelado.
 */
export function installContextRecovery(
  canvas: ContextEventTarget,
  handlers: ContextRecoveryHandlers,
  options: ContextRecoveryOptions = {},
): ContextRecovery {
  const reload = options.reload ?? (() => window.location.reload())
  const warn = options.warn ?? ((error: unknown) => console.error(error))

  const onLost = (event: Event): void => {
    // Sin esto el navegador no emitirá `webglcontextrestored`.
    event.preventDefault()
    handlers.onLost()
  }

  const onRestored = (): void => {
    try {
      handlers.onRestored()
    } catch (error) {
      // Reconstruir no fue viable: recarga como red de seguridad.
      warn(error)
      reload()
    }
  }

  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    uninstall() {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    },
  }
}
