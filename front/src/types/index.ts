export type Point = 0 | 15 | 30 | 40 | 'Ventaja';

/**
 * Género del jugador. Vive en `types` (dominio) porque es un dato del jugador,
 * no de su representación 3D: la escena (`PlayerAvatar`) lo reutiliza para
 * derivar el diseño del avatar, evitando así la dependencia inversa scene→types.
 */
export type PlayerGender = 'male' | 'female';

export interface Player {
  name: string;
  /** Género del jugador; alimenta el diseño del avatar (pelo, ropa, silueta). */
  gender: PlayerGender;
}

export interface Team {
  players: [Player, Player];
}

export interface Score {
  currentPoint: [Point, Point];
  games: [number, number][];
  sets: [number, number];
}

export interface Match {
  teams: [Team, Team];
  score: Score;
}

export interface Court {
  id: number;
  name: string;
  match: Match | null;
}
