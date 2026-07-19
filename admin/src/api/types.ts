// Contrato de la API (espejo de back .../Contracts/ApiContract.cs y de
// front/src/data/apiContract.ts). El punto viaja como número (0/15/30/40) o "AD".

export type ApiGender = 'male' | 'female'
export type ApiPoint = 0 | 15 | 30 | 40 | 'AD'

export interface ApiPlayer {
  name: string
  gender: ApiGender
}

export interface ApiTeam {
  players: [ApiPlayer, ApiPlayer]
}

export interface ApiScore {
  currentPoint: [ApiPoint, ApiPoint]
  games: [number, number][]
  sets: [number, number]
}

export interface ApiMatch {
  teams: [ApiTeam, ApiTeam]
  score: ApiScore
}

export interface ApiCourt {
  id: number
  name: string
  match: ApiMatch | null
}

// ── Torneos (espejo de back .../Admin/TournamentAdminDtos.cs) ────────────────
// A diferencia del contrato de pistas, estos DTOs son del panel admin y viajan
// con las propiedades en español. Las fechas de torneo son 'yyyy-MM-dd'; las de
// inscripción, fecha-hora ISO sin zona ('yyyy-MM-ddTHH:mm:ss').

export type TorneoGenero = 'masculino' | 'femenino' | 'mixto'

export interface TorneoCategoria {
  id: number
  /** 1 = Primera, 2 = Segunda, 3 = Tercera… */
  nivel: number
  genero: TorneoGenero
  /** "A", "B"… si hay varias del mismo nivel y género; null si es única. */
  letra: string | null
}

export interface Torneo {
  id: number
  nombre: string
  fechaInicio: string
  fechaFin: string
  inscripcionApertura: string
  inscripcionCierre: string
  pistasDisponibles: number
  categorias: TorneoCategoria[]
}

/** Cuerpo de alta/edición de un torneo (el servidor valida las mismas reglas). */
export type GuardarTorneo = Omit<Torneo, 'id' | 'categorias'>

// ── Jugadores e inscripciones (espejo de back .../Admin/PlayerAdminDtos.cs) ──

export interface Jugador {
  id: number
  nombre: string
  telefonos: string[]
}

export type InscripcionEstado = 'pendiente' | 'aceptada' | 'rechazada' | 'retirada'

/** Franja disponible de la pareja: día del torneo ('yyyy-MM-dd') y hora (0–23). */
export interface SlotDisponibilidad {
  fecha: string
  hora: number
}

export interface Inscripcion {
  id: number
  categoryId: number
  jugador1: Jugador
  jugador2: Jugador
  estado: InscripcionEstado
  pagada: boolean
  disponibilidad: SlotDisponibilidad[]
}

/** Al inscribir: jugador existente (id) o nuevo inline (nombre [+ telefonos]). */
export interface JugadorRef {
  id?: number
  nombre?: string
  telefonos?: string[]
}

/** Histórico del jugador: torneos en los que participa y sus partidos. */
export interface HistorialJugador {
  id: number
  nombre: string
  torneos: HistorialTorneo[]
}

export interface HistorialTorneo {
  torneoId: number
  torneoNombre: string
  categoria: TorneoCategoria
  estado: InscripcionEstado
  partidos: HistorialPartido[]
}

/** `ganado` es null mientras el partido no tenga ganador. */
export interface HistorialPartido {
  id: number
  fechaHora: string | null
  resultado: string | null
  ganado: boolean | null
  rivales: string[]
}
