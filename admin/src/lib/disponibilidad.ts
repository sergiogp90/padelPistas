import type { SlotDisponibilidad } from '@/api/types'
import { fechaLocal } from './torneos'

// Lógica de la rejilla de disponibilidad (días del torneo × franjas horarias),
// separada de la UI para testearla. Cada franja es la hora en punto de inicio;
// el estado de la rejilla se maneja como un Set de claves "yyyy-MM-ddTHH".

/** Franja horaria habitual de juego en un club (de 9:00 a 22:00–23:00). */
export const HORA_PRIMERA = 9
export const HORA_ULTIMA = 22

/** Tope de seguridad de la rejilla si el torneo tiene fechas disparatadas. */
const MAX_DIAS = 60

export function horasDelDia(): number[] {
  return Array.from({ length: HORA_ULTIMA - HORA_PRIMERA + 1 }, (_, i) => HORA_PRIMERA + i)
}

/** Días de juego del torneo, ambos extremos incluidos, como 'yyyy-MM-dd'. */
export function diasDelTorneo(fechaInicio: string, fechaFin: string): string[] {
  const dias: string[] = []
  const fin = fechaLocal(fechaFin).getTime()
  let dia = fechaLocal(fechaInicio)
  while (dia.getTime() <= fin && dias.length < MAX_DIAS) {
    dias.push(aIso(dia))
    dia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1)
  }
  return dias
}

function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function claveSlot(fecha: string, hora: number): string {
  return `${fecha}T${hora}`
}

export function setDesdeSlots(slots: SlotDisponibilidad[]): Set<string> {
  return new Set(slots.map((s) => claveSlot(s.fecha, s.hora)))
}

/** Set de claves → slots del contrato, ordenados por fecha y hora. */
export function slotsDesdeSet(claves: Set<string>): SlotDisponibilidad[] {
  return [...claves]
    .map((clave) => {
      const [fecha, hora] = clave.split('T')
      return { fecha, hora: Number(hora) }
    })
    .sort((a, b) => (a.fecha === b.fecha ? a.hora - b.hora : a.fecha.localeCompare(b.fecha)))
}

/** "2026-09-07" → "lun 7" (para las cabeceras de la rejilla). */
export function etiquetaDia(fecha: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' }).format(fechaLocal(fecha))
}
