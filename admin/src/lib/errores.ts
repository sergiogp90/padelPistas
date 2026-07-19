import { ApiError } from '@/api/client'

/**
 * Mensaje para un toast de error: si la API devolvió un cuerpo con explicación
 * (los endpoints admin responden 400/409 con texto en español), se muestra ese;
 * si no, el mensaje por defecto.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  if (!(err instanceof ApiError)) return porDefecto
  return desentrecomillar(err.message) || porDefecto
}

/** Los endpoints devuelven el texto como JSON (`"mensaje"`): fuera comillas. */
function desentrecomillar(mensaje: string): string {
  if (mensaje.startsWith('"') && mensaje.endsWith('"')) {
    try {
      return String(JSON.parse(mensaje))
    } catch {
      // no era JSON válido: se muestra tal cual
    }
  }
  return mensaje
}
