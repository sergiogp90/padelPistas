import type { ApiMatch, ApiGender, ApiPoint } from '@/api/types'

// Puntos válidos del juego, en orden. La ventaja viaja como "AD".
export const PUNTOS: readonly ApiPoint[] = [0, 15, 30, 40, 'AD']

export function etiquetaPunto(punto: ApiPoint): string {
  return punto === 'AD' ? 'Ventaja' : String(punto)
}

export interface JugadorForm {
  name: string
  gender: ApiGender
}

/**
 * Modelo de formulario del marcador. Para el panel del operador editamos el set
 * en curso (juegos) + sets ganados + punto actual; es lo que se ve en el marcador.
 * El historial completo de sets se abordará con el dominio de torneos.
 */
export interface PartidoForm {
  // Orden: equipo 1 (j1, j2), equipo 2 (j1, j2).
  jugadores: [JugadorForm, JugadorForm, JugadorForm, JugadorForm]
  setsA: number
  setsB: number
  juegosA: number
  juegosB: number
  puntoA: ApiPoint
  puntoB: ApiPoint
}

export const PARTIDO_INICIAL: PartidoForm = {
  jugadores: [
    { name: '', gender: 'male' },
    { name: '', gender: 'male' },
    { name: '', gender: 'female' },
    { name: '', gender: 'female' },
  ],
  setsA: 0,
  setsB: 0,
  juegosA: 0,
  juegosB: 0,
  puntoA: 0,
  puntoB: 0,
}

/** Construye el DTO ApiMatch a partir del formulario. */
export function construirPartido(form: PartidoForm): ApiMatch {
  const [a1, a2, b1, b2] = form.jugadores
  return {
    teams: [{ players: [a1, a2] }, { players: [b1, b2] }],
    score: {
      currentPoint: [form.puntoA, form.puntoB],
      games: [[form.juegosA, form.juegosB]],
      sets: [form.setsA, form.setsB],
    },
  }
}

/** Rellena el formulario desde un partido existente (para editarlo). */
export function partidoAForm(match: ApiMatch | null): PartidoForm {
  if (!match) return structuredClone(PARTIDO_INICIAL)
  const [t1, t2] = match.teams
  const setActual = match.score.games.at(-1) ?? [0, 0]
  return {
    jugadores: [t1.players[0], t1.players[1], t2.players[0], t2.players[1]],
    setsA: match.score.sets[0],
    setsB: match.score.sets[1],
    juegosA: setActual[0],
    juegosB: setActual[1],
    puntoA: match.score.currentPoint[0],
    puntoB: match.score.currentPoint[1],
  }
}

/** Devuelve el primer error de validación, o null si el formulario es válido. */
export function validarPartido(form: PartidoForm): string | null {
  if (form.jugadores.some((j) => !j.name.trim())) return 'Todos los jugadores necesitan nombre.'
  const numeros = [form.setsA, form.setsB, form.juegosA, form.juegosB]
  if (numeros.some((n) => !Number.isInteger(n) || n < 0)) return 'Sets y juegos deben ser enteros no negativos.'
  return null
}
