// Lógica de las pantallas de jugadores, separada de la UI para testearla.

/**
 * El formulario pide los teléfonos en un solo campo separados por comas (o punto
 * y coma); aquí se convierten a la lista limpia del contrato: sin vacíos, sin
 * espacios sobrantes y sin duplicados.
 */
export function parsearTelefonos(cadena: string): string[] {
  return [...new Set(cadena.split(/[,;]/).map((t) => t.trim()).filter((t) => t.length > 0))]
}

/** Resumen de un torneo del histórico: "3 partidos · 2 ganados" (o "Sin partidos"). */
export function resumenPartidos(total: number, ganados: number): string {
  if (total === 0) return 'Sin partidos todavía'
  const partidos = `${total} partido${total === 1 ? '' : 's'}`
  return `${partidos} · ${ganados} ganado${ganados === 1 ? '' : 's'}`
}
