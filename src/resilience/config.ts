// Umbrales de la red de seguridad (watchdog + captura global de errores).
//
// Punto ÚNICO donde se ajustan los tiempos y contadores de la auto-recuperación,
// de modo que afinar el comportamiento en la TV (más/menos tolerante) no exige
// tocar la lógica del watchdog ni del renderer. Todos son sobreescribibles por
// opción en cada módulo; estos son solo los valores por defecto.

/**
 * Milisegundos sin pintar un nuevo fotograma tras los cuales el watchdog
 * considera que el bucle de render está detenido y trata de reanimarlo. Un
 * margen holgado (varios segundos) evita falsos positivos por microcortes.
 */
export const STALL_TIMEOUT_MS = 5_000

/**
 * Cada cuánto comprueba el watchdog si el contador de fotogramas ha avanzado.
 * Bastante más corto que `STALL_TIMEOUT_MS` para detectar el atasco con
 * prontitud sin malgastar CPU.
 */
export const WATCHDOG_CHECK_INTERVAL_MS = 1_000

/**
 * Número de reinicios del bucle permitidos dentro de `RESTART_WINDOW_MS` antes
 * de rendirse y recargar la página (recuperación dura). Si un reinicio no basta
 * y el problema persiste, tras estos intentos se recarga.
 */
export const MAX_RESTARTS = 3

/**
 * Ventana deslizante (ms) para contar reinicios. Reinicios más antiguos que esto
 * dejan de contar, de modo que fallos aislados y espaciados en el tiempo no
 * acaban forzando una recarga.
 */
export const RESTART_WINDOW_MS = 60_000

/**
 * Milisegundos que el overlay de error permanece visible antes de ocultarse
 * solo. Corto y discreto: informa al operador de un incidente puntual sin dejar
 * texto fijo sobre la imagen de la TV.
 */
export const ERROR_OVERLAY_TIMEOUT_MS = 6_000

// --- Resiliencia de la fuente de datos de API (ver `data/ApiDataSource.ts`) ---

/**
 * Fallos de sondeo consecutivos tras los cuales el `ApiDataSource` da la pista
 * por «sin datos» (estado `offline`) y la TV lo señala. Un margen mayor que 1
 * evita marcar «sin datos» ante un microcorte que se recupera al primer
 * reintento; los datos de respaldo se siguen mostrando entretanto.
 */
export const API_OFFLINE_THRESHOLD = 2

/**
 * Retardo del primer reintento tras un fallo de sondeo (ms). Bastante más corto
 * que el intervalo normal para recuperarse pronto de un fallo transitorio.
 */
export const API_RETRY_BASE_MS = 1_000

/**
 * Tope del retardo de reintento (ms) con la API caída de forma sostenida: el
 * *backoff* exponencial no espera más que esto entre sondeos, de modo que la
 * pantalla se recupera sola en cuanto la API vuelve sin martillearla mientras no.
 */
export const API_MAX_BACKOFF_MS = 30_000

/** Factor de crecimiento del *backoff* de reintentos (exponencial). */
export const API_BACKOFF_FACTOR = 2
