import { describe, it, expect, vi } from 'vitest';
import {
  resolveDataSourceConfig,
  DEFAULT_API_BASE_URL,
} from './dataSourceConfig';

// `env` de prueba: `import.meta.env` no expone las claves `VITE_*` en los tests,
// así que las inyectamos con la forma mínima que el reader lee.
function env(values: Record<string, string | undefined> = {}): ImportMetaEnv {
  return values as unknown as ImportMetaEnv;
}

describe('resolveDataSourceConfig', () => {
  it('usa api por defecto cuando no hay configuración', () => {
    const config = resolveDataSourceConfig({ env: env(), search: '' });
    expect(config.kind).toBe('api');
    expect(config.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });

  it('lee la fuente de VITE_DATA_SOURCE', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'api' }),
      search: '',
    });
    expect(config.kind).toBe('api');
  });

  it('usa mock solo si se pide explícitamente (env var)', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'mock' }),
      search: '',
    });
    expect(config.kind).toBe('mock');
  });

  it('usa mock solo si se pide explícitamente (?source=mock)', () => {
    const config = resolveDataSourceConfig({
      env: env(),
      search: '?source=mock',
    });
    expect(config.kind).toBe('mock');
  });

  it('normaliza el valor (espacios y mayúsculas)', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: '  API  ' }),
      search: '',
    });
    expect(config.kind).toBe('api');
  });

  it('el parámetro ?source= tiene prioridad sobre la env var', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'mock' }),
      search: '?source=api',
    });
    expect(config.kind).toBe('api');
  });

  it('cae a api (avisando) ante un valor desconocido', () => {
    const warn = vi.fn();
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'postgres' }),
      search: '',
      warn,
    });
    expect(config.kind).toBe('api');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('cae a api ante un ?source= desconocido, sin mirar la env', () => {
    const warn = vi.fn();
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'mock' }),
      search: '?source=nope',
      warn,
    });
    // El query gana; al no reconocerse, fallback a api (no vuelve a la env).
    expect(config.kind).toBe('api');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('trata la cadena vacía como ausencia (api, sin aviso)', () => {
    const warn = vi.fn();
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: '   ' }),
      search: '',
      warn,
    });
    expect(config.kind).toBe('api');
    expect(warn).not.toHaveBeenCalled();
  });

  it('lee y normaliza VITE_API_BASE_URL (recorta la barra final)', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_DATA_SOURCE: 'api', VITE_API_BASE_URL: 'https://club/api/' }),
      search: '',
    });
    expect(config.apiBaseUrl).toBe('https://club/api');
  });

  it('usa la base por defecto si VITE_API_BASE_URL está vacía', () => {
    const config = resolveDataSourceConfig({
      env: env({ VITE_API_BASE_URL: '  ' }),
      search: '',
    });
    expect(config.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
  });
});
