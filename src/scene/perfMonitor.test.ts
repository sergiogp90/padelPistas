import { describe, it, expect, vi } from 'vitest'
import {
  installPerfMonitor,
  isPerfMonitorEnabled,
  type StatsPanel,
} from './perfMonitor'

/**
 * Tests del monitor de rendimiento activable por flag. Con un doble del panel de
 * `stats.js` (misma forma: `dom`, `begin`, `end`) y una `search` inyectada,
 * comprueban que solo se activa con `?stats`, que inserta el panel en el
 * contenedor y le delega `begin()`/`end()`, que sin el flag es inerte (sin panel
 * ni llamadas) y que `uninstall` retira el panel —incluso si aún no había cargado.
 */

// Deja correr las microtareas pendientes: `installPerfMonitor` carga el panel de
// forma perezosa (Promise), así que hay que esperar a que resuelva antes de
// comprobar que se insertó en el DOM.
const flush = () => Promise.resolve()

// Doble mínimo del panel de `stats.js`: un `dom` real (para poder insertarlo y
// retirarlo del contenedor) y `begin`/`end` espiables.
function makePanel(): StatsPanel & { begin: ReturnType<typeof vi.fn> } {
  return {
    dom: document.createElement('div'),
    begin: vi.fn(),
    end: vi.fn(),
  }
}

describe('isPerfMonitorEnabled', () => {
  it('es true cuando la URL contiene el flag ?stats', () => {
    expect(isPerfMonitorEnabled('?stats')).toBe(true)
    expect(isPerfMonitorEnabled('?foo=1&stats')).toBe(true)
    expect(isPerfMonitorEnabled('?stats=1')).toBe(true)
  })

  it('es false sin el flag', () => {
    expect(isPerfMonitorEnabled('')).toBe(false)
    expect(isPerfMonitorEnabled('?foo=1')).toBe(false)
  })
})

describe('installPerfMonitor', () => {
  it('sin el flag es inerte: no crea panel ni toca el contenedor', async () => {
    const container = document.createElement('div')
    const createStats = vi.fn()

    const monitor = installPerfMonitor({ search: '', container, createStats })
    monitor.begin()
    monitor.end()
    await flush()

    expect(createStats).not.toHaveBeenCalled()
    expect(container.childElementCount).toBe(0)
  })

  it('con el flag inserta el panel y le delega begin()/end()', async () => {
    const container = document.createElement('div')
    const panel = makePanel()

    const monitor = installPerfMonitor({
      search: '?stats',
      container,
      createStats: () => panel,
    })
    await flush()

    expect(container.contains(panel.dom)).toBe(true)

    monitor.begin()
    monitor.end()
    expect(panel.begin).toHaveBeenCalledTimes(1)
    expect(panel.end).toHaveBeenCalledTimes(1)
  })

  it('begin()/end() antes de cargar el panel no fallan (no-op)', () => {
    const container = document.createElement('div')
    const monitor = installPerfMonitor({
      search: '?stats',
      container,
      createStats: () => makePanel(),
    })

    // El panel se carga de forma asíncrona; llamar antes de que resuelva es inocuo.
    expect(() => {
      monitor.begin()
      monitor.end()
    }).not.toThrow()
  })

  it('uninstall retira el panel del DOM', async () => {
    const container = document.createElement('div')
    const panel = makePanel()

    const monitor = installPerfMonitor({
      search: '?stats',
      container,
      createStats: () => panel,
    })
    await flush()
    expect(container.contains(panel.dom)).toBe(true)

    monitor.uninstall()
    expect(container.contains(panel.dom)).toBe(false)
  })

  it('uninstall antes de cargar el panel evita insertar uno obsoleto', async () => {
    const container = document.createElement('div')
    const panel = makePanel()

    const monitor = installPerfMonitor({
      search: '?stats',
      container,
      createStats: () => panel,
    })
    // Se retira mientras la carga perezosa aún está pendiente.
    monitor.uninstall()
    await flush()

    expect(container.contains(panel.dom)).toBe(false)
  })
})
