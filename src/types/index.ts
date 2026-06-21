export type Point = 0 | 15 | 30 | 40 | 'Ventaja';

export interface Player {
  name: string;
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
