// Mantiene la pantalla encendida mediante la Wake Lock API mientras la página
// esté visible. Una TV de club puede entrar en reposo por su salvapantallas o
// ahorro de energía; el "screen wake lock" se lo impide.
//
// El sistema libera el lock automáticamente cuando la pestaña se oculta (p. ej.
// al cambiar de app), así que hay que re-adquirirlo al volver a `visible`. Eso
// es justo lo que escucha `visibilitychange`.
//
// Se define un contrato mínimo propio (en vez de depender de los tipos del DOM)
// para poder inyectar dobles en los tests y degradar con elegancia si el
// navegador no expone la API.

interface WakeLockSentinelLike {
  release(): Promise<void>
  addEventListener?(type: 'release', listener: () => void): void
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

interface WakeLockNavigator {
  wakeLock?: WakeLockLike
}

export interface WakeLockManager {
  /** Libera el lock (si lo hay) y deja de re-adquirirlo. */
  stop(): void
}

/**
 * Adquiere y mantiene un "screen wake lock". Vuelve a pedirlo cada vez que el
 * documento pasa a `visible` (el sistema lo libera al ocultarse la pestaña).
 *
 * Degradación elegante: si el navegador no soporta la API, o si una petición
 * falla (batería baja, permiso denegado…), no lanza ni rompe nada; simplemente
 * se reintenta en el siguiente `visibilitychange`.
 */
export function createWakeLockManager(
  nav: WakeLockNavigator = navigator,
  doc: Document = document,
): WakeLockManager {
  const api = nav.wakeLock
  if (!api) return { stop() {} }

  let sentinel: WakeLockSentinelLike | null = null
  let stopped = false

  const acquire = async (): Promise<void> => {
    if (stopped || sentinel) return
    try {
      const next = await api.request('screen')
      // Pudo pararse el gestor mientras esperábamos la promesa: no retener.
      if (stopped) {
        void next.release().catch(() => {})
        return
      }
      sentinel = next
      // Al soltarse el lock (p. ej. al ocultar la pestaña) limpiamos la
      // referencia para que el próximo `visibilitychange` lo vuelva a pedir.
      next.addEventListener?.('release', () => {
        if (sentinel === next) sentinel = null
      })
    } catch {
      sentinel = null
    }
  }

  const onVisibilityChange = (): void => {
    if (doc.visibilityState === 'visible') void acquire()
  }

  doc.addEventListener('visibilitychange', onVisibilityChange)
  void acquire()

  return {
    stop() {
      stopped = true
      doc.removeEventListener('visibilitychange', onVisibilityChange)
      const current = sentinel
      sentinel = null
      void current?.release().catch(() => {})
    },
  }
}
