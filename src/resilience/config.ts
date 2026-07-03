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
