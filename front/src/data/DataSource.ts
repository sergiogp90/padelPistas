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

/**
 * Estado de la conexión de una fuente que obtiene los datos por red:
 *  - `connecting`: aún no ha llegado la primera respuesta (se muestra el respaldo).
 *  - `online`: el último sondeo trajo datos frescos.
 *  - `offline`: varios sondeos seguidos han fallado; la pista está «sin datos» y
 *    reintentando. Se vuelve a `online` en cuanto la API responde.
 */
export type ConnectionStatus = 'connecting' | 'online' | 'offline';

/**
 * Fuente de datos que además informa del estado de su conexión, para que la UI
 * pueda señalar «sin datos»/«reconectando» en la TV. Es una extensión OPCIONAL
 * del contrato: las fuentes locales (mock) no la implementan y se consideran
 * siempre disponibles. Consúltala con `isStatusReporting`.
 */
export interface StatusReportingDataSource extends DataSource {
  /** Estado actual de la conexión. */
  getStatus(): ConnectionStatus;

  /**
   * Registra un `listener` que se invoca con cada cambio de estado de conexión.
   * @returns Una función que cancela la suscripción al llamarla.
   */
  subscribeStatus(listener: (status: ConnectionStatus) => void): () => void;
}

/** ¿Esta fuente informa del estado de su conexión (`StatusReportingDataSource`)? */
export function isStatusReporting(
  source: DataSource,
): source is StatusReportingDataSource {
  return (
    typeof (source as Partial<StatusReportingDataSource>).getStatus === 'function' &&
    typeof (source as Partial<StatusReportingDataSource>).subscribeStatus === 'function'
  );
}
