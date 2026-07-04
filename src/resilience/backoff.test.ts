import { describe, it, expect } from 'vitest';
import { backoffDelay } from './backoff';

describe('backoffDelay', () => {
  const options = { baseMs: 1000, maxMs: 30_000, factor: 2 };

  it('el primer reintento espera el retardo base', () => {
    expect(backoffDelay(1, options)).toBe(1000);
  });

  it('crece de forma exponencial con el número de intento', () => {
    expect(backoffDelay(2, options)).toBe(2000);
    expect(backoffDelay(3, options)).toBe(4000);
    expect(backoffDelay(4, options)).toBe(8000);
  });

  it('nunca supera el tope máximo', () => {
    expect(backoffDelay(10, options)).toBe(30_000);
    expect(backoffDelay(100, options)).toBe(30_000);
  });

  it('trata intentos < 1 como el primer intento', () => {
    expect(backoffDelay(0, options)).toBe(1000);
    expect(backoffDelay(-5, options)).toBe(1000);
  });

  it('respeta un factor de crecimiento personalizado', () => {
    expect(backoffDelay(3, { baseMs: 500, maxMs: 100_000, factor: 3 })).toBe(4500);
  });
});
