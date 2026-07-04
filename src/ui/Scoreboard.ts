import './scoreboard.css';
import type { Court, Match, Point } from '../types';
import type { ConnectionStatus, DataSource } from '../data/DataSource';
import { isStatusReporting } from '../data/DataSource';
import { servingTeam } from '../data/score';

// Marcador como overlay HTML/CSS superpuesto al canvas 3D.
//
// Se renderiza fuera del 3D para que el texto sea nítido y legible en una TV.
// Toma un `Court` (hoy alimentado por los datos mock) y construye el DOM del
// marcador con la jerarquía visual típica de una retransmisión: lo importante
// (nombres y punto actual) grande, los detalles (juegos por set) más pequeños.

/**
 * Marca, por equipo, qué celdas acaban de cambiar respecto al render anterior,
 * para resaltarlas con una breve animación. Cada tupla es `[equipo0, equipo1]`.
 */
export interface ScoreboardHighlight {
  /** El punto actual del equipo cambió. */
  point: [boolean, boolean];
  /** Los juegos del set en curso del equipo cambiaron. */
  games: [boolean, boolean];
  /** Los sets ganados del equipo cambiaron. */
  sets: [boolean, boolean];
}

/** Opciones de render del marcador (todas opcionales). */
export interface ScoreboardOptions {
  /**
   * Colores CSS de los dos equipos (equipo 0 y equipo 1), coherentes con los
   * asignados a la pista en el 3D. Si se omite, se usa el acento por defecto.
   */
  teamColors?: readonly [string, string];
  /** Celdas a resaltar por haber cambiado en esta actualización. */
  highlight?: ScoreboardHighlight;
  /**
   * Estado de la conexión de la fuente. Si es distinto de `online` (o
   * `undefined`), se pinta un aviso «conectando»/«sin datos» sobre el marcador
   * para que se vea a distancia de TV que los datos no están frescos.
   */
  status?: ConnectionStatus;
}

/** Texto del aviso de conexión para cada estado no disponible. */
const STATUS_LABELS: Record<Exclude<ConnectionStatus, 'online'>, string> = {
  connecting: 'Conectando…',
  offline: 'Sin datos · reconectando…',
};

/**
 * Añade al marcador un aviso de conexión cuando los datos no están frescos
 * (`connecting`/`offline`). En `online` (o sin estado) no pinta nada. El aviso es
 * un rótulo de alto contraste, legible en la TV, que no oculta los nombres ni el
 * marcador: solo señala que lo mostrado es el último dato conocido (de respaldo).
 */
function appendStatusBadge(overlay: HTMLElement, status: ConnectionStatus): void {
  if (status === 'online') return;
  const badge = document.createElement('div');
  badge.className = `scoreboard__status scoreboard__status--${status}`;
  badge.textContent = STATUS_LABELS[status];
  // `role="status"` para que los lectores anuncien el cambio de estado.
  badge.setAttribute('role', 'status');
  overlay.appendChild(badge);
}

/** Formatea un punto de pádel para mostrarlo (la ventaja se abrevia "Vent."). */
export function formatPoint(point: Point): string {
  return point === 'Ventaja' ? 'Vent.' : String(point);
}

/** Añade una clase de resalte si la celda cambió (dispara la animación CSS). */
function markChanged(el: HTMLElement, changed: boolean | undefined): void {
  if (changed) el.classList.add('scoreboard__value--changed');
}

/**
 * Construye una fila de equipo: distintivo de color, nombres, juegos de cada
 * set, sets ganados y el punto actual. `teamIndex` (0 ó 1) selecciona el lado
 * de cada par. `serving` marca si este equipo está al saque.
 */
function createTeamRow(
  match: Match,
  teamIndex: 0 | 1,
  serving: boolean,
  options: ScoreboardOptions,
): HTMLElement {
  const { teams, score } = match;
  const { teamColors, highlight } = options;
  const row = document.createElement('div');
  row.className = serving
    ? 'scoreboard__row scoreboard__row--serving'
    : 'scoreboard__row';

  // Distintivo de color del equipo (coherente con el color de la pista en 3D).
  // Cuando el equipo está al saque, se resalta como indicador de servicio.
  const chip = document.createElement('span');
  chip.className = 'scoreboard__chip';
  chip.setAttribute('aria-hidden', 'true');
  if (teamColors) chip.style.setProperty('--team-color', teamColors[teamIndex]);
  row.appendChild(chip);

  // Nombres del equipo (elemento grande, jerarquía principal).
  const names = document.createElement('div');
  names.className = 'scoreboard__names';
  for (const player of teams[teamIndex].players) {
    const line = document.createElement('span');
    line.className = 'scoreboard__player';
    line.textContent = player.name;
    names.appendChild(line);
  }
  // Etiqueta accesible del saque (no visible: el indicador visual es el chip).
  if (serving) {
    const serveLabel = document.createElement('span');
    serveLabel.className = 'scoreboard__serve-label';
    serveLabel.textContent = 'Al saque';
    names.appendChild(serveLabel);
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
    // Solo el set en curso puede cambiar en vivo; resaltar esa celda.
    if (isCurrentSet) markChanged(cell, highlight?.games[teamIndex]);
    games.appendChild(cell);
  });
  row.appendChild(games);

  // Sets ganados (destacado).
  const sets = document.createElement('div');
  sets.className = 'scoreboard__sets';
  sets.textContent = String(score.sets[teamIndex]);
  markChanged(sets, highlight?.sets[teamIndex]);
  row.appendChild(sets);

  // Punto actual del juego (elemento grande, jerarquía principal).
  const point = document.createElement('div');
  point.className = 'scoreboard__point';
  point.textContent = formatPoint(score.currentPoint[teamIndex]);
  markChanged(point, highlight?.point[teamIndex]);
  row.appendChild(point);

  return row;
}

/**
 * Crea el overlay del marcador para una pista. Devuelve un elemento listo para
 * insertar en el DOM (p. ej. `document.body`). Si la pista no tiene partido en
 * curso, muestra un estado de "sin partido".
 */
export function createScoreboard(
  court: Court,
  options: ScoreboardOptions = {},
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'scoreboard';

  const title = document.createElement('div');
  title.className = 'scoreboard__title';
  title.textContent = court.name;
  overlay.appendChild(title);

  // Aviso de conexión (si la fuente lo reporta y no está `online`): se pinta
  // antes del cuerpo para que sea lo primero visible, incluso sin partido.
  if (options.status) appendStatusBadge(overlay, options.status);

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

  // Hueco del distintivo de color para alinear la cabecera con las filas.
  const headerChip = document.createElement('span');
  headerChip.className = 'scoreboard__chip scoreboard__chip--empty';
  headerChip.setAttribute('aria-hidden', 'true');
  header.appendChild(headerChip);

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
  const serving = servingTeam(court.match.score);
  overlay.appendChild(createTeamRow(court.match, 0, serving === 0, options));
  overlay.appendChild(createTeamRow(court.match, 1, serving === 1, options));

  return overlay;
}

/**
 * Compara el marcador de dos `Court` y devuelve qué celdas han cambiado, para
 * resaltarlas. Si no hay partido previo (o cambió su presencia) devuelve
 * `undefined`: no tiene sentido animar el primer render ni la aparición del
 * partido.
 */
function diffScores(prev: Court | null, next: Court): ScoreboardHighlight | undefined {
  if (!prev?.match || !next.match) return undefined;
  const a = prev.match.score;
  const b = next.match.score;
  // Juegos del set en curso (el único que puede avanzar en vivo).
  const lastA = a.games[a.games.length - 1];
  const lastB = b.games[b.games.length - 1];
  return {
    point: [
      a.currentPoint[0] !== b.currentPoint[0],
      a.currentPoint[1] !== b.currentPoint[1],
    ],
    games: [lastA?.[0] !== lastB?.[0], lastA?.[1] !== lastB?.[1]],
    sets: [a.sets[0] !== b.sets[0], a.sets[1] !== b.sets[1]],
  };
}

/**
 * Monta un marcador en vivo a partir de un `DataSource`: renderiza el estado
 * actual y se re-renderiza ante cada cambio que emita la fuente. Devuelve un
 * contenedor estable (listo para insertar en el DOM); el contenido interior se
 * sustituye de una sola vez por cambio, sin estados intermedios visibles.
 *
 * Cada actualización compara el marcador con el anterior y resalta brevemente
 * las celdas que han cambiado (punto/juego/set) para dar feedback visual.
 *
 * Si la fuente informa del estado de su conexión (`isStatusReporting`), el
 * marcador se suscribe también a él y pinta un aviso «conectando»/«sin datos»
 * mientras la API no responde, retirándolo al recuperarse (ver #103). Las fuentes
 * locales (mock) no reportan estado y se muestran siempre como disponibles.
 *
 * @param source  Fuente de datos de la pista.
 * @param options Colores de equipo del overlay (coherentes con el 3D).
 * @returns Un objeto con el elemento `el` y `stop()` para cancelar la suscripción.
 */
export function mountScoreboard(
  source: DataSource,
  options: Pick<ScoreboardOptions, 'teamColors'> = {},
): {
  el: HTMLElement;
  stop: () => void;
} {
  const container = document.createElement('div');
  container.className = 'scoreboard-mount';

  let prev: Court | null = null;
  // Últimos valores conocidos: cada render usa el `Court` y el estado actuales,
  // se dispare por un cambio de datos o por un cambio de conexión.
  let court = source.getCourt();
  const statusReporting = isStatusReporting(source);
  let status: ConnectionStatus = statusReporting ? source.getStatus() : 'online';

  const render = (): void => {
    // Reconstruir el marcador y reemplazar el contenido en un único paso para
    // evitar parpadeos (no hay momento con el contenedor a medio pintar). Al
    // reconstruir el DOM, las clases de resalte disparan su animación al montar.
    const highlight = diffScores(prev, court);
    container.replaceChildren(createScoreboard(court, { ...options, highlight, status }));
    prev = court;
  };

  render();
  const unsubscribe = source.subscribe((next) => {
    court = next;
    render();
  });
  // Un cambio de estado re-renderiza con el mismo `Court` (prev === court), así
  // que no resalta celdas: solo aparece/desaparece el aviso de conexión.
  const unsubscribeStatus = statusReporting
    ? source.subscribeStatus((next) => {
        status = next;
        render();
      })
    : () => {};

  return {
    el: container,
    stop: () => {
      unsubscribe();
      unsubscribeStatus();
    },
  };
}
