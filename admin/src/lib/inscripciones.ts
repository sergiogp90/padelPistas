import type { InscripcionEstado, JugadorRef } from '@/api/types'

// Lógica de la pantalla de inscripciones, separada de la UI para testearla.

export const ESTADOS: InscripcionEstado[] = ['pendiente', 'aceptada', 'rechazada', 'retirada']

export function nombreEstado(estado: InscripcionEstado): string {
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

/** Variante del Badge por estado: aceptada resalta, rechazada avisa. */
export function varianteEstado(
  estado: InscripcionEstado,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (estado) {
    case 'aceptada':
      return 'default'
    case 'rechazada':
      return 'destructive'
    case 'retirada':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Construye la referencia de un jugador para el alta de pareja: el seleccionado
 * del buscador manda; si no hay, se crea uno nuevo con nombre (obligatorio) y
 * teléfono opcional. Devuelve un error legible si faltan datos.
 */
export function construirJugadorRef(
  seleccionadoId: number | null,
  nombreNuevo: string,
  telefonoNuevo: string,
  etiqueta: string,
): { ref: JugadorRef } | { error: string } {
  if (seleccionadoId !== null) return { ref: { id: seleccionadoId } }

  const nombre = nombreNuevo.trim()
  if (!nombre) return { error: `Busca un jugador existente o escribe el nombre del ${etiqueta}.` }

  const telefono = telefonoNuevo.trim()
  return { ref: { nombre, telefonos: telefono ? [telefono] : [] } }
}
