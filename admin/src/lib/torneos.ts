import type { GuardarTorneo, TorneoCategoria, TorneoGenero } from '@/api/types'

// Lógica del formulario de torneos, separada de la UI para poder testearla:
// validación (las mismas reglas que aplica el servidor), construcción del cuerpo
// y formato de fechas para las tablas.

/** Valores crudos del formulario; las fechas llegan como 'yyyy-MM-dd' (o '' si faltan). */
export interface TorneoFormValues {
  nombre: string
  fechaInicio: string
  fechaFin: string
  inscripcionApertura: string
  inscripcionCierre: string
  pistasDisponibles: number
}

export function validarTorneo(v: TorneoFormValues): string | null {
  if (!v.nombre.trim()) return 'El nombre del torneo es obligatorio.'
  if (!v.fechaInicio || !v.fechaFin) return 'Elige las fechas de inicio y fin del torneo.'
  if (v.fechaFin < v.fechaInicio) return 'La fecha de fin no puede ser anterior a la de inicio.'
  if (!v.inscripcionApertura || !v.inscripcionCierre) return 'Elige el plazo de inscripción.'
  if (v.inscripcionCierre < v.inscripcionApertura)
    return 'El cierre de inscripciones no puede ser anterior a la apertura.'
  if (!Number.isInteger(v.pistasDisponibles) || v.pistasDisponibles < 1)
    return 'Indica cuántas pistas se reservan para el torneo (mínimo 1).'
  return null
}

/** El plazo de inscripción se maneja por días completos: abre a las 00:00 y cierra a las 23:59. */
export function construirTorneo(v: TorneoFormValues): GuardarTorneo {
  return {
    nombre: v.nombre.trim(),
    fechaInicio: v.fechaInicio,
    fechaFin: v.fechaFin,
    inscripcionApertura: `${v.inscripcionApertura}T00:00:00`,
    inscripcionCierre: `${v.inscripcionCierre}T23:59:59`,
    pistasDisponibles: v.pistasDisponibles,
  }
}

/**
 * 'yyyy-MM-dd…' → Date local. Evita `new Date(iso)` con fechas sin hora, que se
 * interpretan como UTC y pueden retroceder un día al mostrarse en local.
 */
export function fechaLocal(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    fechaLocal(iso),
  )
}

export function formatearRango(inicioIso: string, finIso: string): string {
  return inicioIso.slice(0, 10) === finIso.slice(0, 10)
    ? formatearFecha(inicioIso)
    : `${formatearFecha(inicioIso)} – ${formatearFecha(finIso)}`
}

const NIVELES = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava']

/** 1 → "Primera", 3 → "Tercera"… (a partir de la octava, "Nivel 9"). */
export function nombreNivel(nivel: number): string {
  return NIVELES[nivel - 1] ?? `Nivel ${nivel}`
}

/** Niveles ofrecidos en el selector de categorías (los de nombre conocido). */
export const NIVELES_DISPONIBLES = NIVELES.map((_, i) => i + 1)

export function nombreGenero(genero: TorneoGenero): string {
  return genero.charAt(0).toUpperCase() + genero.slice(1)
}

/** "Tercera B — Masculino" (sin letra mientras la categoría sea única). */
export function etiquetaCategoria(c: Pick<TorneoCategoria, 'nivel' | 'genero' | 'letra'>): string {
  const letra = c.letra ? ` ${c.letra}` : ''
  return `${nombreNivel(c.nivel)}${letra} — ${nombreGenero(c.genero)}`
}
