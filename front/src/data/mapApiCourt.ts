import type { Court, Match, Player, Point, Score, Team } from '../types';
import type {
  ApiCourt,
  ApiMatch,
  ApiPlayer,
  ApiPoint,
  ApiScore,
  ApiTeam,
} from './apiContract';

// Adaptador puro del contrato de la API (`apiContract.ts`) a los tipos del
// dominio. Traduce el DTO "en crudo" que llega por la red a `Court`/`Match`/
// `Score`/`Player`, que es lo único que conocen el 3D y la UI.
//
// Todas las funciones son puras: construyen objetos nuevos sin mutar la entrada
// y clonan las tuplas del marcador, de modo que el `Court` resultante no
// comparte referencias con el DTO (la lógica de `score.ts` trabaja sobre tuplas
// propias). No hace ninguna llamada de red: eso es tarea del `ApiDataSource`.

/**
 * Traduce el punto del contrato al dominio: `"AD"` → `'Ventaja'`, y el resto de
 * valores numéricos pasan tal cual. El `default` protege frente a un JSON
 * malformado (los tipos se borran en runtime, así que el cable podría traer
 * cualquier cosa) lanzando un error claro en lugar de propagar un valor inválido.
 */
function mapPoint(point: ApiPoint): Point {
  switch (point) {
    case 0:
    case 15:
    case 30:
    case 40:
      return point;
    case 'AD':
      return 'Ventaja';
    default:
      throw new Error(
        `mapApiCourt: punto desconocido en la respuesta de la API: ${JSON.stringify(point)}`,
      );
  }
}

function mapPlayer(dto: ApiPlayer): Player {
  return { name: dto.name, gender: dto.gender };
}

function mapTeam(dto: ApiTeam): Team {
  return { players: [mapPlayer(dto.players[0]), mapPlayer(dto.players[1])] };
}

function mapScore(dto: ApiScore): Score {
  return {
    currentPoint: [mapPoint(dto.currentPoint[0]), mapPoint(dto.currentPoint[1])],
    // Clonamos cada tupla para no compartir referencias con el DTO de entrada.
    games: dto.games.map((set) => [set[0], set[1]] as [number, number]),
    sets: [dto.sets[0], dto.sets[1]],
  };
}

function mapMatch(dto: ApiMatch): Match {
  return {
    teams: [mapTeam(dto.teams[0]), mapTeam(dto.teams[1])],
    score: mapScore(dto.score),
  };
}

/**
 * Mapea una pista del contrato de la API a `Court`. Cubre el caso de pista sin
 * partido (`match: null`), que se propaga como `null` al dominio.
 */
export function mapApiCourt(dto: ApiCourt): Court {
  return {
    id: dto.id,
    name: dto.name,
    match: dto.match === null ? null : mapMatch(dto.match),
  };
}

/** Mapea la respuesta del listado (`GET /api/courts`) a un array de `Court`. */
export function mapApiCourts(dtos: ApiCourt[]): Court[] {
  return dtos.map(mapApiCourt);
}
