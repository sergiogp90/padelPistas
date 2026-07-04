import { describe, it, expect } from 'vitest';
import { mountScoreboard } from './Scoreboard';
import type { ConnectionStatus, DataSource, StatusReportingDataSource } from '../data/DataSource';
import type { Court } from '../types';

/** `DataSource` de prueba controlable manualmente: emite cuando se le pide. */
function createFakeSource(initial: Court) {
  let court = initial;
  const listeners = new Set<(c: Court) => void>();
  const source: DataSource = {
    getCourt: () => court,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = (next: Court) => {
    court = next;
    listeners.forEach((l) => l(next));
  };
  return { source, emit };
}

/** Fuente de prueba que además reporta estado de conexión (`StatusReportingDataSource`). */
function createFakeStatusSource(initial: Court, initialStatus: ConnectionStatus = 'connecting') {
  let court = initial;
  let status = initialStatus;
  const listeners = new Set<(c: Court) => void>();
  const statusListeners = new Set<(s: ConnectionStatus) => void>();
  const source: StatusReportingDataSource = {
    getCourt: () => court,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
  const emit = (next: Court) => {
    court = next;
    listeners.forEach((l) => l(next));
  };
  const emitStatus = (next: ConnectionStatus) => {
    status = next;
    statusListeners.forEach((l) => l(next));
  };
  return { source, emit, emitStatus };
}

function buildCourt(point: 0 | 15 | 30 | 40): Court {
  return {
    id: 1,
    name: 'Pista Central',
    match: {
      teams: [
        { players: [{ name: 'Carlos Ruiz', gender: 'male' }, { name: 'Miguel Sánchez', gender: 'male' }] },
        { players: [{ name: 'Pablo García', gender: 'male' }, { name: 'Javier López', gender: 'male' }] },
      ],
      score: {
        currentPoint: [point, 0],
        games: [[0, 0]],
        sets: [0, 0],
      },
    },
  };
}

describe('mountScoreboard', () => {
  /** Punto del primer equipo (excluye la etiqueta "Punto" de la cabecera). */
  const team0Point = (el: HTMLElement) =>
    el.querySelector(
      '.scoreboard__row:not(.scoreboard__row--header) .scoreboard__point',
    )?.textContent;

  it('renderiza el estado inicial de la fuente', () => {
    const { source } = createFakeSource(buildCourt(15));
    const { el } = mountScoreboard(source);

    expect(team0Point(el)).toBe('15');
  });

  it('se re-renderiza cuando la fuente emite un cambio', () => {
    const { source, emit } = createFakeSource(buildCourt(0));
    const { el } = mountScoreboard(source);

    expect(team0Point(el)).toBe('0');

    emit(buildCourt(40));

    expect(team0Point(el)).toBe('40');
    // No se acumulan marcadores: el contenido se sustituye, no se añade.
    expect(el.querySelectorAll('.scoreboard').length).toBe(1);
  });

  it('no resalta nada en el primer render', () => {
    const { source } = createFakeSource(buildCourt(15));
    const { el } = mountScoreboard(source);

    expect(el.querySelectorAll('.scoreboard__value--changed')).toHaveLength(0);
  });

  it('resalta el punto que cambia entre actualizaciones', () => {
    const { source, emit } = createFakeSource(buildCourt(0));
    const { el } = mountScoreboard(source);

    emit(buildCourt(40));

    const changed = el.querySelector(
      '.scoreboard__row:not(.scoreboard__row--header) .scoreboard__point.scoreboard__value--changed',
    );
    expect(changed?.textContent).toBe('40');
  });

  it('deja de re-renderizarse tras llamar a stop()', () => {
    const { source, emit } = createFakeSource(buildCourt(0));
    const { el, stop } = mountScoreboard(source);

    stop();
    emit(buildCourt(40));

    expect(team0Point(el)).toBe('0');
  });

  describe('estado de conexión', () => {
    const badge = (el: HTMLElement) => el.querySelector('.scoreboard__status');

    it('no pinta aviso para fuentes sin reporte de estado (mock)', () => {
      const { source } = createFakeSource(buildCourt(15));
      const { el } = mountScoreboard(source);
      expect(badge(el)).toBeNull();
    });

    it('refleja el estado inicial de la fuente al montar', () => {
      const { source } = createFakeStatusSource(buildCourt(15), 'connecting');
      const { el } = mountScoreboard(source);
      expect(badge(el)?.textContent).toContain('Conectando');
    });

    it('muestra «sin datos» al pasar la fuente a offline y lo retira al volver a online', () => {
      const { source, emitStatus } = createFakeStatusSource(buildCourt(15), 'online');
      const { el } = mountScoreboard(source);
      expect(badge(el)).toBeNull();

      emitStatus('offline');
      expect(badge(el)?.classList.contains('scoreboard__status--offline')).toBe(true);
      // El marcador sigue mostrando el último dato conocido (de respaldo).
      expect(team0Point(el)).toBe('15');

      emitStatus('online');
      expect(badge(el)).toBeNull();
    });

    it('un cambio de estado no resalta celdas (mismo Court)', () => {
      const { source, emitStatus } = createFakeStatusSource(buildCourt(15), 'online');
      const { el } = mountScoreboard(source);
      emitStatus('offline');
      expect(el.querySelectorAll('.scoreboard__value--changed')).toHaveLength(0);
    });

    it('deja de reaccionar a cambios de estado tras stop()', () => {
      const { source, emitStatus } = createFakeStatusSource(buildCourt(15), 'online');
      const { el, stop } = mountScoreboard(source);
      stop();
      emitStatus('offline');
      expect(badge(el)).toBeNull();
    });
  });
});
