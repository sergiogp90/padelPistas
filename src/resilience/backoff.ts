// Cálculo del retardo de reintento con *backoff* exponencial.
//
// Pieza pura y sin estado de la red de seguridad: dado el número de intento
// consecutivo fallido, devuelve cuántos milisegundos esperar antes del siguiente
// reintento. Crece de forma exponencial (2^n por defecto) desde `baseMs` hasta un
// tope `maxMs`, de modo que un fallo transitorio se reintenta pronto pero, si la
// API sigue caída, el ritmo se relaja para no martillearla ni gastar batería/CPU
// en la TV. Se aísla aquí para poder probarlo solo y reutilizarlo (hoy lo usa
// `ApiDataSource`).

export interface BackoffOptions {
  /** Retardo del primer reintento (ms). */
  baseMs: number;
  /** Tope máximo del retardo (ms); ningún reintento espera más que esto. */
  maxMs: number;
  /** Factor de crecimiento entre reintentos (por defecto 2 → exponencial). */
  factor?: number;
}

/**
 * Retardo (ms) del reintento número `attempt` (1 = primer reintento tras el
 * primer fallo). Fórmula: `min(baseMs * factor^(attempt-1), maxMs)`. Valores de
 * `attempt` menores que 1 se tratan como 1.
 */
export function backoffDelay(attempt: number, options: BackoffOptions): number {
  const { baseMs, maxMs, factor = 2 } = options;
  // El primer reintento es el exponente 0; nunca por debajo de 1.
  const exponent = Math.max(0, Math.floor(attempt) - 1);
  const delay = baseMs * Math.pow(factor, exponent);
  return Math.min(delay, maxMs);
}
