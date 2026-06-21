import './scoreboard.css';
import type { Court, Match, Point } from '../types';

// Marcador como overlay HTML/CSS superpuesto al canvas 3D.
//
// Se renderiza fuera del 3D para que el texto sea nítido y legible en una TV.
// Toma un `Court` (hoy alimentado por los datos mock) y construye el DOM del
// marcador con la jerarquía visual típica de una retransmisión: lo importante
// (nombres y punto actual) grande, los detalles (juegos por set) más pequeños.

/** Formatea un punto de pádel para mostrarlo (la ventaja se abrevia "Vent."). */
function formatPoint(point: Point): string {
  return point === 'Ventaja' ? 'Vent.' : String(point);
}

/**
 * Construye una fila de equipo: nombres, juegos de cada set, sets ganados y
 * el punto actual. `teamIndex` (0 ó 1) selecciona el lado de cada par.
 */
function createTeamRow(match: Match, teamIndex: 0 | 1): HTMLElement {
  const { teams, score } = match;
  const row = document.createElement('div');
  row.className = 'scoreboard__row';

  // Nombres del equipo (elemento grande, jerarquía principal).
  const names = document.createElement('div');
  names.className = 'scoreboard__names';
  for (const player of teams[teamIndex].players) {
    const line = document.createElement('span');
    line.className = 'scoreboard__player';
    line.textContent = player.name;
    names.appendChild(line);
  }
  row.appendChild(names);

  // Juegos de cada set (una celda por set, detalle pequeño).
  const games = document.createElement('div');
  games.className = 'scoreboard__games';
  score.games.forEach((setGames, setIndex) => {
    const cell = document.createElement('span');
    const isCurrentSet = setIndex === score.games.length - 1;
    cell.className = isCurrentSet
      ? 'scoreboard__game scoreboard__game--current'
      : 'scoreboard__game';
    cell.textContent = String(setGames[teamIndex]);
    games.appendChild(cell);
  });
  row.appendChild(games);

  // Sets ganados (destacado).
  const sets = document.createElement('div');
  sets.className = 'scoreboard__sets';
  sets.textContent = String(score.sets[teamIndex]);
  row.appendChild(sets);

  // Punto actual del juego (elemento grande, jerarquía principal).
  const point = document.createElement('div');
  point.className = 'scoreboard__point';
  point.textContent = formatPoint(score.currentPoint[teamIndex]);
  row.appendChild(point);

  return row;
}

/**
 * Crea el overlay del marcador para una pista. Devuelve un elemento listo para
 * insertar en el DOM (p. ej. `document.body`). Si la pista no tiene partido en
 * curso, muestra un estado de "sin partido".
 */
export function createScoreboard(court: Court): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'scoreboard';

  const title = document.createElement('div');
  title.className = 'scoreboard__title';
  title.textContent = court.name;
  overlay.appendChild(title);

  if (!court.match) {
    const empty = document.createElement('div');
    empty.className = 'scoreboard__empty';
    empty.textContent = 'Sin partido en curso';
    overlay.appendChild(empty);
    return overlay;
  }

  // Cabecera de columnas: etiquetas para juegos por set, sets y punto.
  const header = document.createElement('div');
  header.className = 'scoreboard__row scoreboard__row--header';

  const headerNames = document.createElement('div');
  headerNames.className = 'scoreboard__names';
  header.appendChild(headerNames);

  const headerGames = document.createElement('div');
  headerGames.className = 'scoreboard__games';
  court.match.score.games.forEach((_, setIndex) => {
    const label = document.createElement('span');
    label.className = 'scoreboard__game';
    label.textContent = `S${setIndex + 1}`;
    headerGames.appendChild(label);
  });
  header.appendChild(headerGames);

  const headerSets = document.createElement('div');
  headerSets.className = 'scoreboard__sets scoreboard__label';
  headerSets.textContent = 'Sets';
  header.appendChild(headerSets);

  const headerPoint = document.createElement('div');
  headerPoint.className = 'scoreboard__point scoreboard__label';
  headerPoint.textContent = 'Punto';
  header.appendChild(headerPoint);

  overlay.appendChild(header);
  overlay.appendChild(createTeamRow(court.match, 0));
  overlay.appendChild(createTeamRow(court.match, 1));

  return overlay;
}
