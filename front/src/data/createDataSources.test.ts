import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataSources } from './createDataSources';
import { ApiDataSource } from './ApiDataSource';
import { MockDataSource } from './MockDataSource';
import { createMockCourts } from './createMockCourts';
import type { ApiCourt } from './apiContract';

// Respuesta `ok` mínima con el DTO indicado (mismo helper que ApiDataSource.test).
function okResponse(dto: ApiCourt): Response {
  return { ok: true, status: 200, json: async () => dto } as unknown as Response;
}

describe('createDataSources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('modo mock (por defecto)', () => {
    it('crea N MockDataSource diferenciadas', () => {
      const sources = createDataSources(3, { config: { kind: 'mock', apiBaseUrl: '/api' } });
      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s instanceof MockDataSource)).toBe(true);

      const ids = sources.map((s) => s.getCourt().id);
      expect(new Set(ids).size).toBe(3);
    });

    it('propaga opciones del mock (intervalMs/random)', () => {
      const sources = createDataSources(2, {
        config: { kind: 'mock', apiBaseUrl: '/api' },
        intervalMs: 100,
        random: () => 0,
      });
      const listener = vi.fn();
      sources[0].subscribe(listener);

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(1);

      sources.forEach((s) => (s as MockDataSource).stop());
    });
  });

  describe('modo api', () => {
    it('crea N ApiDataSource, una por pista', () => {
      const sources = createDataSources(3, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: vi.fn(),
      });
      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s instanceof ApiDataSource)).toBe(true);
    });

    it('siembra cada fuente con la pista mock homónima (respaldo antes de la red)', () => {
      const sources = createDataSources(2, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: vi.fn(),
      });
      const seeds = createMockCourts(2);
      expect(sources[0].getCourt()).toEqual(seeds[0]);
      expect(sources[1].getCourt()).toEqual(seeds[1]);
    });

    it('sondea el endpoint {apiBaseUrl}/courts/:id de cada pista', async () => {
      const fetchFn = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(okResponse({ id: 1, name: `Desde ${url}`, match: null })),
        );
      const sources = createDataSources(2, {
        config: { kind: 'api', apiBaseUrl: 'https://club/api' },
        fetch: fetchFn,
      });
      sources.forEach((s) => s.subscribe(() => {}));

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts/1');
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts/2');

      sources.forEach((s) => (s as ApiDataSource).stop());
    });

    it('encamina los errores de red a onError sin romper (fallback al dato de respaldo)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('sin red'));
      const onError = vi.fn();
      const sources = createDataSources(1, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: fetchFn,
        onError,
      });
      const seed = createMockCourts(1)[0];
      sources[0].subscribe(() => {});

      await vi.advanceTimersByTimeAsync(0);
      expect(onError).toHaveBeenCalledOnce();
      // La pista conserva el estado de respaldo (mock) pese al fallo de red.
      expect(sources[0].getCourt()).toEqual(seed);

      sources.forEach((s) => (s as ApiDataSource).stop());
    });
  });
});
