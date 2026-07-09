import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataSources } from './createDataSources';
import { ApiDataSource } from './ApiDataSource';
import { MockDataSource } from './MockDataSource';
import { mapApiCourt } from './mapApiCourt';
import type { ApiCourt } from './apiContract';

// Respuesta `ok` mínima con el cuerpo indicado (sirve para el listado y para una
// pista concreta).
function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

// Respuesta HTTP de error (sin cuerpo útil).
function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

// DTO de pista mínimo (sin partido) para poblar el listado `GET /api/courts`.
function apiCourt(id: number, name = `Pista ${id}`): ApiCourt {
  return { id, name, match: null };
}

/**
 * `fetch` de doble propósito para el modo api: responde al listado
 * `{base}/courts` con `courts` y a `{base}/courts/:id` con la pista de ese id
 * (404 si el id no está en el listado, para detectar peticiones a ids que la API
 * no sirve).
 */
function routedFetch(courts: ApiCourt[], base = '/api') {
  // `vi.fn().mockImplementation(...)` (en vez de `vi.fn((url) => ...)`) mantiene
  // el tipo genérico del mock asignable a `typeof fetch`.
  return vi.fn().mockImplementation((url: string) => {
    if (url === `${base}/courts`) return Promise.resolve(okResponse(courts));
    const match = /\/courts\/(\d+)$/.exec(url);
    if (match) {
      const id = Number(match[1]);
      const found = courts.find((c) => c.id === id);
      return Promise.resolve(found ? okResponse(found) : errorResponse(404));
    }
    return Promise.resolve(errorResponse(404));
  });
}

describe('createDataSources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('modo mock (explícito)', () => {
    it('crea N MockDataSource diferenciadas', async () => {
      const sources = await createDataSources(3, {
        config: { kind: 'mock', apiBaseUrl: '/api' },
      });
      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s instanceof MockDataSource)).toBe(true);

      const ids = sources.map((s) => s.getCourt().id);
      expect(new Set(ids).size).toBe(3);
    });

    it('propaga opciones del mock (intervalMs/random)', async () => {
      const sources = await createDataSources(2, {
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
    it('deriva el nº de pistas y sus ids del listado GET /api/courts (no del argumento)', async () => {
      // El listado sirve 3 pistas con ids no consecutivos; el `fallbackCount` (4)
      // debe ignorarse por completo en modo api.
      const listed = [apiCourt(1), apiCourt(2), apiCourt(7)];
      const sources = await createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: routedFetch(listed),
      });

      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s instanceof ApiDataSource)).toBe(true);
      expect(sources.map((s) => s.getCourt().id)).toEqual([1, 2, 7]);
    });

    it('siembra cada fuente con la pista del listado (respaldo antes del primer sondeo)', async () => {
      const listed = [apiCourt(1, 'Pista Central'), apiCourt(2, 'Pista Norte')];
      const sources = await createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: routedFetch(listed),
      });

      expect(sources[0].getCourt()).toEqual(mapApiCourt(listed[0]));
      expect(sources[1].getCourt()).toEqual(mapApiCourt(listed[1]));
    });

    it('sondea el endpoint {apiBaseUrl}/courts/:id de cada pista del listado', async () => {
      const listed = [apiCourt(1), apiCourt(2), apiCourt(7)];
      const fetchFn = routedFetch(listed, 'https://club/api');
      const sources = await createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: 'https://club/api' },
        fetch: fetchFn,
      });
      sources.forEach((s) => s.subscribe(() => {}));

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts');
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts/1');
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts/2');
      expect(fetchFn).toHaveBeenCalledWith('https://club/api/courts/7');

      sources.forEach((s) => (s as ApiDataSource).stop());
    });

    it('no pide ids que la API no sirve (sin 404 en bucle)', async () => {
      // La API solo sirve 3 pistas; nunca debe pedirse /courts/4 (el bug #123).
      const listed = [apiCourt(1), apiCourt(2), apiCourt(3)];
      const fetchFn = routedFetch(listed);
      const sources = await createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: fetchFn,
      });
      sources.forEach((s) => s.subscribe(() => {}));

      await vi.advanceTimersByTimeAsync(0);
      const requested = fetchFn.mock.calls.map(([url]) => url);
      expect(requested).not.toContain('/api/courts/4');

      sources.forEach((s) => (s as ApiDataSource).stop());
    });

    it('NO cae a mock: si la API arranca inactiva reintenta y al operar carga las pistas reales', async () => {
      // La API está inactiva los 2 primeros intentos (red caída) y se pone
      // operativa al tercero: la factoría reintenta con backoff, encamina cada
      // fallo a onError y termina con las pistas REALES, sin ninguna fuente mock
      // (issue #130).
      const listed = [apiCourt(1), apiCourt(2)];
      let listCalls = 0;
      const fetchFn = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/courts') {
          listCalls++;
          if (listCalls <= 2) return Promise.reject(new Error('sin red'));
          return Promise.resolve(okResponse(listed));
        }
        const match = /\/courts\/(\d+)$/.exec(url);
        if (match) {
          const id = Number(match[1]);
          const found = listed.find((c) => c.id === id);
          return Promise.resolve(found ? okResponse(found) : errorResponse(404));
        }
        return Promise.resolve(errorResponse(404));
      });
      const onError = vi.fn();

      const promise = createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: fetchFn,
        onError,
        retryBaseMs: 1000,
        maxBackoffMs: 30_000,
        backoffFactor: 2,
      });

      // Cubrimos los backoffs de los 2 reintentos (1s y luego 2s) hasta que la
      // API responde.
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      const sources = await promise;

      expect(onError).toHaveBeenCalledTimes(2);
      expect(sources).toHaveLength(2);
      expect(sources.every((s) => s instanceof ApiDataSource)).toBe(true);
      expect(sources.some((s) => s instanceof MockDataSource)).toBe(false);
      expect(sources.map((s) => s.getCourt().id)).toEqual([1, 2]);

      sources.forEach((s) => (s as ApiDataSource).stop());
    });

    it('reintenta también ante HTTP no-OK y listado vacío (nunca cae a mock)', async () => {
      // Primer intento HTTP 500, segundo listado vacío, tercero operativo: en
      // ningún caso se construyen fuentes mock.
      const listed = [apiCourt(1)];
      let listCalls = 0;
      const fetchFn = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/courts') {
          listCalls++;
          if (listCalls === 1) return Promise.resolve(errorResponse(500));
          if (listCalls === 2) return Promise.resolve(okResponse([]));
          return Promise.resolve(okResponse(listed));
        }
        return Promise.resolve(errorResponse(404));
      });
      const onError = vi.fn();

      const promise = createDataSources(3, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: fetchFn,
        onError,
        retryBaseMs: 1000,
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      const sources = await promise;

      expect(onError).toHaveBeenCalledTimes(2);
      expect(sources).toHaveLength(1);
      expect(sources.every((s) => s instanceof ApiDataSource)).toBe(true);
      expect(sources.some((s) => s instanceof MockDataSource)).toBe(false);

      sources.forEach((s) => (s as ApiDataSource).stop());
    });

    it('encamina los errores de sondeo a onError sin romper (respaldo al dato del listado)', async () => {
      // El listado responde, pero el sondeo por pista falla: la pista conserva el
      // Court del listado y el error se encamina a onError.
      const listed = [apiCourt(1, 'Pista Central')];
      const fetchFn = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/courts') return Promise.resolve(okResponse(listed));
        return Promise.reject(new Error('sin red'));
      });
      const onError = vi.fn();
      const sources = await createDataSources(4, {
        config: { kind: 'api', apiBaseUrl: '/api' },
        fetch: fetchFn,
        onError,
      });
      sources[0].subscribe(() => {});

      await vi.advanceTimersByTimeAsync(0);
      expect(onError).toHaveBeenCalled();
      expect(sources[0].getCourt()).toEqual(mapApiCourt(listed[0]));

      sources.forEach((s) => (s as ApiDataSource).stop());
    });
  });
});
