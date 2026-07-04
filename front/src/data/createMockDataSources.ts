import { createMockCourts } from './createMockCourts';
import { MockDataSource, type MockDataSourceOptions } from './MockDataSource';

// Fábrica de N fuentes de datos mock, una por pista. Cada `MockDataSource`
// simula su partido de forma independiente (temporizador y estado propios), tal
// y como necesita la rejilla del hito M3.

/** Opciones comunes a todas las fuentes, salvo la semilla (que es por pista). */
export type MockDataSourcesOptions = Omit<MockDataSourceOptions, 'seed'>;

/**
 * Crea `n` pistas mock diferenciadas y devuelve una `MockDataSource` por pista.
 *
 * Cada fuente parte de su propia semilla (ver `createMockCourts`) y avanza su
 * partido sin afectar a las demás.
 *
 * @param n Número de pistas/fuentes a crear.
 * @param options Opciones aplicadas a cada `MockDataSource` (p. ej. `intervalMs`).
 */
export function createMockDataSources(
  n: number,
  options: MockDataSourcesOptions = {},
): MockDataSource[] {
  return createMockCourts(n).map(
    (court) => new MockDataSource({ ...options, seed: court }),
  );
}
