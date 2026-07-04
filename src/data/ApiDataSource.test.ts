import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Court } from '../types';
import type { ApiCourt } from './apiContract';
import type { DataSource } from './DataSource';
import { ApiDataSource } from './ApiDataSource';

// Court semilla mínimo que devuelve `getCourt()` hasta el primer fetch.
function seedCourt(): Court {
  return {
    id: 1,
    name: 'Pista Test',
    match: {
      teams: [
        { players: [{ name: 'A1', gender: 'male' }, { name: 'A2', gender: 'female' }] },
        { players: [{ name: 'B1', gender: 'male' }, { name: 'B2', gender: 'female' }] },
      ],
      score: { currentPoint: [0, 0], games: [[0, 0]], sets: [0, 0] },
    },
  };
}

// DTO tal como llegaría de `GET /api/courts/:id`, parametrizado por el punto
// actual del equipo local para simular el avance del marcador entre sondeos.
function apiCourt(localPoint: 0 | 15 | 30 | 40 | 'AD'): ApiCourt {
  return {
    id: 1,
    name: 'Pista Central',
    match: {
      teams: [
        {
          players: [
            { name: 'Carlos Ruiz', gender: 'male' },
            { name: 'Miguel Sánchez', gender: 'male' },
          ],
        },
        {
          players: [
            { name: 'Lucía Fernández', gender: 'female' },
            { name: 'Marta Gómez', gender: 'female' },
          ],
        },
      ],
      score: { currentPoint: [localPoint, 0], games: [[0, 0]], sets: [0, 0] },
    },
  };
}

// Respuesta `ok` mínima con el DTO indicado (`fetch` devuelve un `Response`).
function okResponse(dto: ApiCourt): Response {
  return { ok: true, status: 200, json: async () => dto } as unknown as Response;
}

describe('ApiDataSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('implementa la interfaz DataSource', () => {
    const source: DataSource = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      fetch: vi.fn(),
    });
    expect(typeof source.getCourt).toBe('function');
    expect(typeof source.subscribe).toBe('function');
  });

  it('getCourt() devuelve el estado inicial antes del primer fetch', () => {
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      fetch: vi.fn(),
    });
    expect(source.getCourt()).toEqual(seedCourt());
  });

  it('no muta el Court semilla original', () => {
    const seed = seedCourt();
    const source = new ApiDataSource({ url: '/api/courts/1', initialCourt: seed, fetch: vi.fn() });
    source.getCourt().name = 'Cambiada';
    expect(seed.name).toBe('Pista Test');
    source.stop();
  });

  it('emite el Court inicial (primer fetch) al suscribirse', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(apiCourt(15)));
    const source = new ApiDataSource({ url: '/api/courts/1', initialCourt: seedCourt(), fetch: fetchFn });
    const listener = vi.fn();
    source.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledWith('/api/courts/1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getCourt().name).toBe('Pista Central');
    expect(source.getCourt().match?.score.currentPoint).toEqual([15, 0]);

    source.stop();
  });

  it('emite actualizaciones periódicas en cada intervalo', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(okResponse(apiCourt(15)))
      .mockResolvedValueOnce(okResponse(apiCourt(30)))
      .mockResolvedValueOnce(okResponse(apiCourt(40)));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 1000,
      fetch: fetchFn,
    });
    const listener = vi.fn();
    source.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0); // fetch inmediato
    expect(source.getCourt().match?.score.currentPoint).toEqual([15, 0]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(source.getCourt().match?.score.currentPoint).toEqual([30, 0]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(source.getCourt().match?.score.currentPoint).toEqual([40, 0]);

    expect(listener).toHaveBeenCalledTimes(3);
    source.stop();
  });

  it('la función de baja detiene el polling cuando no hay suscriptores', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(apiCourt(15)));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 1000,
      fetch: fetchFn,
    });
    const unsubscribe = source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    unsubscribe();
    // El temporizador quedó limpio y no se sondea más.
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sigue sondeando para los suscriptores restantes', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(apiCourt(15)));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 1000,
      fetch: fetchFn,
    });
    const unsubscribeA = source.subscribe(vi.fn());
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    unsubscribeA();
    // Aún queda un suscriptor: el sondeo continúa.
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    source.stop();
  });

  it('encamina los errores de red a onError sin romper el sondeo', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(okResponse(apiCourt(30)));
    const onError = vi.fn();
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 1000,
      fetch: fetchFn,
      onError,
    });
    const listener = vi.fn();
    source.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0); // primer fetch falla
    expect(onError).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    // El estado se mantiene en el inicial tras el error.
    expect(source.getCourt().name).toBe('Pista Test');

    await vi.advanceTimersByTimeAsync(1000); // el siguiente sondeo se recupera
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getCourt().match?.score.currentPoint).toEqual([30, 0]);

    source.stop();
  });

  it('reintenta con backoff exponencial mientras la API sigue caída', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('sin red'));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 5000,
      retryBaseMs: 1000,
      maxBackoffMs: 8000,
      backoffFactor: 2,
      fetch: fetchFn,
    });
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0); // fallo 1 → reintento en 1000
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // fallo 2 → reintento en 2000
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000); // fallo 3 → reintento en 4000
    expect(fetchFn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(4000); // fallo 4 → reintento tope 8000
    expect(fetchFn).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(8000);
    expect(fetchFn).toHaveBeenCalledTimes(5);

    source.stop();
  });

  it('vuelve al intervalo normal tras recuperarse de un fallo', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue(okResponse(apiCourt(30)));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 5000,
      retryBaseMs: 1000,
      fetch: fetchFn,
    });
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0); // fallo → reintento en 1000 (backoff)
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // éxito → siguiente al intervalo normal
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Antes del intervalo normal no vuelve a sondear (ya no está en backoff).
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4000); // completa los 5000
    expect(fetchFn).toHaveBeenCalledTimes(3);

    source.stop();
  });

  it('pasa a offline tras el umbral de fallos y vuelve a online al recuperarse', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue(okResponse(apiCourt(30)));
    const onStatusChange = vi.fn();
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      intervalMs: 5000,
      retryBaseMs: 1000,
      offlineThreshold: 2,
      onStatusChange,
      fetch: fetchFn,
    });

    // Empieza en 'connecting' antes de cualquier respuesta.
    expect(source.getStatus()).toBe('connecting');
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0); // fallo 1: aún no llega al umbral
    expect(source.getStatus()).toBe('connecting');

    await vi.advanceTimersByTimeAsync(1000); // fallo 2: alcanza el umbral → offline
    expect(source.getStatus()).toBe('offline');

    await vi.advanceTimersByTimeAsync(2000); // recupera → online
    expect(source.getStatus()).toBe('online');

    expect(onStatusChange).toHaveBeenCalledWith('offline');
    expect(onStatusChange).toHaveBeenCalledWith('online');
    source.stop();
  });

  it('notifica los cambios de estado a subscribeStatus', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(apiCourt(15)));
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      fetch: fetchFn,
    });
    const statusListener = vi.fn();
    const unsubscribe = source.subscribeStatus(statusListener);
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(statusListener).toHaveBeenCalledWith('online');

    unsubscribe();
    source.stop();
  });

  it('trata una respuesta HTTP no-ok como error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as unknown as Response);
    const onError = vi.fn();
    const source = new ApiDataSource({
      url: '/api/courts/1',
      initialCourt: seedCourt(),
      fetch: fetchFn,
      onError,
    });
    source.subscribe(vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    source.stop();
  });
});
