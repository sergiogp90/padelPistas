import { describe, it, expect } from 'vitest';
import { createScoreboard, formatPoint } from './Scoreboard';
import type { Court, Match } from '../types';

/** Crea un partido de ejemplo: set 1 completado (6-4) y set 2 en curso (3-2). */
function buildMatch(): Match {
  return {
    teams: [
      { players: [{ name: 'Carlos Ruiz' }, { name: 'Miguel Sánchez' }] },
      { players: [{ name: 'Pablo García' }, { name: 'Javier López' }] },
    ],
    score: {
      currentPoint: [30, 15],
      games: [
        [6, 4],
        [3, 2],
      ],
      sets: [1, 0],
    },
  };
}

function buildCourt(match: Match | null): Court {
  return { id: 1, name: 'Pista Central', match };
}

describe('formatPoint', () => {
  it("abrevia 'Ventaja' como 'Vent.'", () => {
    expect(formatPoint('Ventaja')).toBe('Vent.');
  });

  it('muestra el resto de puntos como su número', () => {
    expect(formatPoint(0)).toBe('0');
    expect(formatPoint(15)).toBe('15');
    expect(formatPoint(30)).toBe('30');
    expect(formatPoint(40)).toBe('40');
  });
});

describe('createScoreboard', () => {
  describe('con partido en curso', () => {
    it('renderiza 2 filas de equipo (sin contar la cabecera)', () => {
      const overlay = createScoreboard(buildCourt(buildMatch()));
      const teamRows = overlay.querySelectorAll(
        '.scoreboard__row:not(.scoreboard__row--header)',
      );
      expect(teamRows).toHaveLength(2);
    });

    it('la cabecera tiene tantas celdas S1, S2… como sets haya en score.games', () => {
      const overlay = createScoreboard(buildCourt(buildMatch()));
      const header = overlay.querySelector('.scoreboard__row--header');
      const labels = header?.querySelectorAll('.scoreboard__games .scoreboard__game');
      expect(labels).toHaveLength(2);
      expect(Array.from(labels ?? []).map((l) => l.textContent)).toEqual(['S1', 'S2']);
    });

    it('marca el set actual (último) con la clase --current', () => {
      const overlay = createScoreboard(buildCourt(buildMatch()));
      const teamRows = overlay.querySelectorAll(
        '.scoreboard__row:not(.scoreboard__row--header)',
      );
      teamRows.forEach((row) => {
        const cells = row.querySelectorAll('.scoreboard__games .scoreboard__game');
        // El último set (índice length - 1) lleva la clase --current; el resto no.
        cells.forEach((cell, index) => {
          const isCurrent = index === cells.length - 1;
          expect(cell.classList.contains('scoreboard__game--current')).toBe(isCurrent);
        });
      });
    });

    it('muestra los nombres de ambos jugadores de cada equipo en su fila', () => {
      const overlay = createScoreboard(buildCourt(buildMatch()));
      const teamRows = overlay.querySelectorAll(
        '.scoreboard__row:not(.scoreboard__row--header)',
      );

      const team0Names = Array.from(
        teamRows[0].querySelectorAll('.scoreboard__player'),
      ).map((el) => el.textContent);
      expect(team0Names).toEqual(['Carlos Ruiz', 'Miguel Sánchez']);

      const team1Names = Array.from(
        teamRows[1].querySelectorAll('.scoreboard__player'),
      ).map((el) => el.textContent);
      expect(team1Names).toEqual(['Pablo García', 'Javier López']);
    });
  });

  describe('sin partido', () => {
    it("muestra el estado 'Sin partido en curso'", () => {
      const overlay = createScoreboard(buildCourt(null));
      const empty = overlay.querySelector('.scoreboard__empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toBe('Sin partido en curso');
      // No debe renderizar filas de equipo.
      expect(
        overlay.querySelectorAll('.scoreboard__row:not(.scoreboard__row--header)'),
      ).toHaveLength(0);
    });
  });
});
