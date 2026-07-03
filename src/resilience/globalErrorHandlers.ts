// Captura global de errores no controlados.
//
// En funcionamiento desatendido (una TV encendida días) cualquier excepción que
// escape a los try/catch —o una promesa rechazada sin `catch`— puede pasar
// inadvertida y, en el peor caso, dejar la interfaz en un estado inconsistente.
// El navegador emite dos eventos globales para justo esto: `error` (errores
// síncronos, equivalente a `window.onerror`) y `unhandledrejection` (promesas
// rechazadas sin manejar).
//
// Este módulo solo los cablea y los reenvía a un callback y a un registro, SIN
// romper la app: no relanza, no hace `preventDefault` (deja que el navegador los
// registre también en consola) y nunca deja que un fallo del propio manejador
// tumbe la app. La recuperación del render la hace el watchdog; aquí solo
// registramos y, opcionalmente, avisamos (overlay). Las dependencias se inyectan
// para poder probarlo aislado, como el resto de módulos de resiliencia.

/**
 * Contrato mínimo del objeto global: solo necesitamos suscribir y retirar los
 * dos eventos de error. Se define estructuralmente (en vez de exigir `Window`)
 * para poder inyectar dobles en los tests.
 */
export interface ErrorEventTarget {
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

/** Descripción normalizada de un error capturado, para registro y overlay. */
export interface CapturedError {
  /** Origen del error: excepción síncrona o promesa rechazada. */
  kind: 'error' | 'unhandledrejection'
  /** Mensaje legible extraído del error (o un texto genérico si no hay). */
  message: string
  /** El valor original del error/rechazo, por si el consumidor quiere más datos. */
  cause: unknown
}

export interface GlobalErrorHandlersOptions {
  /** Objeto donde suscribir los eventos. Por defecto `window` (inyectable en tests). */
  target?: ErrorEventTarget
  /** Se invoca con cada error capturado (p. ej. para mostrar el overlay). */
  onError?: (error: CapturedError) => void
  /** Registro del error. Por defecto `console.error`. */
  warn?: (error: CapturedError) => void
}

export interface GlobalErrorHandlers {
  /** Retira ambos listeners (evita fugas y duplicados). */
  uninstall(): void
}

// Extrae un mensaje legible de un valor de error de forma defensiva: puede ser
// un `Error`, un `ErrorEvent`, un string o cualquier cosa lanzada/rechazada.
function messageOf(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Error desconocido'
}

/**
 * Cablea los manejadores globales de error sobre `target` (por defecto `window`).
 * Devuelve un manejador para retirarlos.
 *
 * - `error`: excepción no capturada. Se extrae su mensaje y se reenvía.
 * - `unhandledrejection`: promesa rechazada sin `catch`. Se usa su `reason`.
 *
 * Ni registra ni avisa de forma que pueda fallar: si `onError`/`warn` lanzan, se
 * ignora (nunca un manejador de errores debe provocar otro error). No se llama a
 * `preventDefault`, de modo que el navegador también los registre en consola.
 */
export function installGlobalErrorHandlers(
  options: GlobalErrorHandlersOptions = {},
): GlobalErrorHandlers {
  const target = options.target ?? (window as unknown as ErrorEventTarget)
  const warn = options.warn ?? ((error: CapturedError) => console.error(error))

  // Reenvía a `warn` y `onError` sin dejar que un fallo de estos propague.
  const report = (captured: CapturedError): void => {
    try {
      warn(captured)
    } catch {
      /* un fallo al registrar no debe romper nada */
    }
    try {
      options.onError?.(captured)
    } catch {
      /* un fallo del aviso (overlay) no debe romper nada */
    }
  }

  const onError = (event: Event): void => {
    // `ErrorEvent` expone `error` (el objeto lanzado) y `message` (texto).
    const e = event as ErrorEvent
    const cause = e.error ?? e.message ?? event
    report({ kind: 'error', message: messageOf(cause), cause })
  }

  const onRejection = (event: Event): void => {
    // `PromiseRejectionEvent` expone `reason` (el valor con el que se rechazó).
    const reason = (event as PromiseRejectionEvent).reason
    report({ kind: 'unhandledrejection', message: messageOf(reason), cause: reason })
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return {
    uninstall() {
      target.removeEventListener('error', onError)
      target.removeEventListener('unhandledrejection', onRejection)
    },
  }
}
