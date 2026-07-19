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
