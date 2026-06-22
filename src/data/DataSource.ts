import type { Court } from '../types';

/**
 * Contrato para obtener el estado de una pista y suscribirse a sus cambios.
 *
 * Esconde el origen de los datos tras una abstracción: hoy lo implementa un
 * `MockDataSource`, pero en el futuro podrá haber un `ApiDataSource` o
 * `ControlPanelDataSource` sin tocar el 3D ni la UI (ver `docs/architecture.md`).
 */
export interface DataSource {
  /** Devuelve el estado actual de la pista. */
  getCourt(): Court;

  /**
   * Registra un `listener` que se invoca con cada cambio de la pista.
   * @returns Una función que cancela la suscripción al llamarla.
   */
  subscribe(listener: (court: Court) => void): () => void;
}
