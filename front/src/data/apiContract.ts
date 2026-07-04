// Contrato de la API propia: la **forma de la respuesta JSON** tal como llega
// por la red, antes de traducirse al dominio.
//
// Estos tipos (`Api*`) describen el JSON "en crudo" y NO son los tipos del
// dominio (`Court`/`Match`/`Score`/`Player`). El adaptador `mapApiCourt`
// (ver `mapApiCourt.ts`) traduce este DTO al dominio. Mantener ambos separados
// permite que el backend evolucione su formato de cable sin arrastrar cambios
// por toda la app: solo se toca el adaptador (ver `docs/architecture.md`, §9).
//
// Endpoints previstos (la llamada de red la implementará el `ApiDataSource`):
//
//   GET /api/courts       -> ApiCourt[]   Estado de todas las pistas.
//   GET /api/courts/:id   -> ApiCourt     Estado de una pista concreta.
//
// Campos de `ApiCourt`:
//   id     number            Identificador único de la pista.
//   name   string            Nombre visible ("Pista Central").
//   match  ApiMatch | null   Partido en curso, o `null` si la pista está libre.

/**
 * Género del jugador tal como lo emite la API. Reutiliza a propósito los mismos
 * tokens que el dominio (`PlayerGender`) para que el contrato sea legible; el
 * adaptador los revalida al mapear en lugar de asumir que el cable es correcto.
 */
export type ApiGender = 'male' | 'female';

/**
 * Punto del juego actual en el contrato. El "0/15/30/40" viaja como número y la
 * ventaja como el token neutro `"AD"` (independiente del idioma). El adaptador
 * traduce `"AD"` al `'Ventaja'` del dominio; así el vocabulario en español vive
 * solo dentro de la app y no se filtra al formato de cable.
 */
export type ApiPoint = 0 | 15 | 30 | 40 | 'AD';

export interface ApiPlayer {
  name: string;
  gender: ApiGender;
}

export interface ApiTeam {
  players: [ApiPlayer, ApiPlayer];
}

export interface ApiScore {
  /** Punto del juego actual de cada equipo: `[local, visitante]`. */
  currentPoint: [ApiPoint, ApiPoint];
  /** Juegos por set: una tupla `[local, visitante]` por cada set jugado o en curso. */
  games: [number, number][];
  /** Sets ganados por cada equipo: `[local, visitante]`. */
  sets: [number, number];
}

export interface ApiMatch {
  teams: [ApiTeam, ApiTeam];
  score: ApiScore;
}

export interface ApiCourt {
  id: number;
  name: string;
  /** `null` cuando la pista no tiene partido en curso. */
  match: ApiMatch | null;
}
