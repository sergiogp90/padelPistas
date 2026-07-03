// Monitor de rendimiento (FPS / ms) activable por flag, SOLO para desarrollo.
//
// Para validar las optimizaciones del bucle de render (cap de FPS, pixel ratio,
// pausa en segundo plano) conviene poder MEDIR en vivo los fotogramas por segundo
// y el tiempo de cada fotograma. Este ayudante integra `stats.js` y lo añade al
// DOM ÚNICAMENTE cuando se pide con el flag `?stats` en la URL; sin el flag no hay
// panel ni coste asociado (ni siquiera se carga `stats.js`, ver `loadStats`), de
// modo que el modo TV/kiosko normal no se ve afectado ni muestra el panel por
// defecto.
//
// El renderer llama a `begin()` al inicio de cada fotograma pintado y a `end()`
// tras dibujarlo (ver `MultiCourtRenderer`): así el panel mide el trabajo real por
// fotograma y los FPS efectivos (que con el cap rondan `TARGET_FPS`). Cuando el
// monitor está desactivado esas llamadas no hacen nada.
//
// El origen de la URL (`search`), el contenedor del DOM y la fábrica del panel se
// inyectan para poder probarlo con dobles, igual que `visibilityPause`,
// `viewRotation` o `contextRecovery`.

/** Nombre del parámetro de URL que activa el monitor: `?stats`. */
export const PERF_MONITOR_FLAG = 'stats'

/**
 * Panel de `stats.js` reducido a lo que usa el bucle de render. La instancia real
 * de `stats.js` lo cumple; en tests se inyecta un doble con esta misma forma.
 */
export interface StatsPanel {
  /** Elemento del panel a insertar en el DOM. */
  readonly dom: HTMLElement
  /** Marca el inicio de la medición de un fotograma. */
  begin(): void
  /** Cierra la medición del fotograma iniciada con `begin()`. */
  end(): number | void
}

/**
 * Handle del monitor. Sus `begin()`/`end()` envuelven el trabajo de cada fotograma
 * pintado; cuando el monitor está desactivado (sin flag) no hacen nada. Cumple la
 * interfaz mínima que espera el renderer.
 */
export interface PerfMonitor {
  /** Inicia la medición del fotograma (no-op si está desactivado). */
  begin(): void
  /** Cierra la medición del fotograma (no-op si está desactivado). */
  end(): void
  /** Retira el panel del DOM (si llegó a mostrarse). */
  uninstall(): void
}

export interface PerfMonitorOptions {
  /** Cadena de búsqueda de la URL (p. ej. `location.search`). Inyectable en tests. */
  search?: string
  /** Contenedor donde insertar el panel. Por defecto `document.body`. */
  container?: HTMLElement
  /**
   * Fábrica del panel `stats.js`. Por defecto lo importa de forma perezosa (solo
   * si el flag está activo) y construye una instancia con el panel de FPS visible.
   * Inyectable en tests para evitar cargar `stats.js` y tocar el DOM real.
   */
  createStats?: () => StatsPanel | Promise<StatsPanel>
}

/** `true` si la cadena de búsqueda de la URL contiene el flag `?stats`. */
export function isPerfMonitorEnabled(search: string): boolean {
  return new URLSearchParams(search).has(PERF_MONITOR_FLAG)
}

// Monitor inerte: lo que se devuelve cuando el flag no está presente. Sin panel,
// sin DOM y con `begin`/`end` vacíos, de modo que el bucle de render no paga coste
// alguno en el modo TV normal.
const DISABLED: PerfMonitor = {
  begin() {},
  end() {},
  uninstall() {},
}

/**
 * Instala el monitor de rendimiento si el flag `?stats` está en la URL. Sin el
 * flag devuelve un monitor inerte (sin panel ni coste). Con el flag carga
 * `stats.js` de forma perezosa, muestra el panel de FPS y lo inserta en el
 * contenedor; hasta que la carga asíncrona termina, `begin()`/`end()` son inocuos.
 */
export function installPerfMonitor(options: PerfMonitorOptions = {}): PerfMonitor {
  const search = options.search ?? window.location.search
  if (!isPerfMonitorEnabled(search)) return DISABLED

  const container = options.container ?? document.body
  const create = options.createStats ?? loadStats

  let stats: StatsPanel | undefined
  // Si se retira el monitor antes de que resuelva la carga perezosa, no hay que
  // insertar el panel ya obsoleto en el DOM.
  let uninstalled = false

  Promise.resolve(create()).then((panel) => {
    if (uninstalled) return
    stats = panel
    container.appendChild(panel.dom)
  })

  return {
    begin() {
      stats?.begin()
    },
    end() {
      stats?.end()
    },
    uninstall() {
      uninstalled = true
      stats?.dom.remove()
      stats = undefined
    },
  }
}

// Carga perezosa de `stats.js`: solo se importa cuando el flag está activo, así el
// panel de desarrollo no entra en el bundle ni corre en producción por defecto.
// `stats.js` es un módulo CommonJS (`export =`), de ahí el acceso a `.default`.
async function loadStats(): Promise<StatsPanel> {
  const module = await import('stats.js')
  const StatsCtor = (module as unknown as { default: new () => StatsPanel }).default
  const stats = new StatsCtor()
  // Panel 0 = FPS (los otros son ms y MB); mostramos FPS por defecto y el usuario
  // puede pulsar el panel para alternar a ms/MB como en cualquier `stats.js`.
  ;(stats as unknown as { showPanel(value: number): void }).showPanel(0)
  return stats
}
