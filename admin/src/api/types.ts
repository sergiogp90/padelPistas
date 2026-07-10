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
