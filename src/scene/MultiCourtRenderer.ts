import * as THREE from 'three'
import { computeViewports, type Rect } from './gridLayout'
import { installContextRecovery, type ContextRecovery } from './contextRecovery'
import type { CourtView } from './CourtView'

// Renderer multipista: un ÚNICO `WebGLRenderer` para todas las pistas.
//
// Crear un renderer (y por tanto un contexto WebGL) por pista choca con el
// límite de contextos del navegador (~8-16) y penaliza el rendimiento. En su
// lugar usamos un solo renderer/canvas a pantalla completa y dibujamos cada
// `CourtView` en su celda mediante `setViewport`/`setScissor` (patrón multi-vista
// estándar de Three.js): el viewport recorta la proyección a la celda y el
// scissor limita el borrado/pintado a ese mismo rectángulo, de modo que cada
// pista conserva su propia cámara y escena sin pisar a las vecinas.

/** Opciones del renderer, sobre todo avisos de pérdida/restauración de contexto. */
export interface MultiCourtRendererOptions {
  /** Se invoca al perderse el contexto WebGL (bucle ya detenido): avisa. */
  onContextLost?: () => void
  /** Se invoca al recuperarse el contexto y reanudar el bucle: retira el aviso. */
  onContextRestored?: () => void
  /** Recarga de último recurso si la restauración no es viable (inyectable en tests). */
  reload?: () => void
}

/**
 * Orquesta el dibujado de N `CourtView` en un único canvas. Reparte la pantalla
 * en una rejilla de celdas (ver `gridLayout`) y renderiza cada vista en la suya.
 *
 * Se recupera solo ante la pérdida del contexto WebGL: para el bucle al perderlo
 * y lo reanuda —reaplicando la configuración del renderer— al restaurarse, sin
 * intervención humana (ver `contextRecovery`).
 */
export class MultiCourtRenderer {
  readonly renderer: THREE.WebGLRenderer

  private views: CourtView[] = []
  private viewports: Rect[] = []
  private frameHandle = 0
  // Evita bucles `requestAnimationFrame` duplicados: `start()` es idempotente y
  // solo hay un bucle vivo aunque se reanude tras recuperar el contexto.
  private running = false
  private readonly recovery: ContextRecovery
  private readonly onContextLost?: () => void
  private readonly onContextRestored?: () => void
  // Reloj para medir el tiempo entre fotogramas y animar de forma independiente
  // de los FPS (ver `CourtView.update`).
  private readonly clock = new THREE.Clock()

  constructor(options: MultiCourtRendererOptions = {}) {
    this.onContextLost = options.onContextLost
    this.onContextRestored = options.onContextRestored

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.configureRenderer()
    this.resize(window.innerWidth, window.innerHeight)

    // Recuperación automática del contexto WebGL sobre el canvas del renderer.
    this.recovery = installContextRecovery(
      this.domElement,
      {
        onLost: () => this.handleContextLost(),
        onRestored: () => this.handleContextRestored(),
      },
      { reload: options.reload },
    )
  }

  // Aplica la configuración del renderer. Se llama al crearlo y al restaurar el
  // contexto, ya que la pérdida invalida el estado GL y hay que reestablecerlo.
  private configureRenderer(): void {
    this.renderer.setPixelRatio(window.devicePixelRatio)
    // Necesario para que cada celda limpie y pinte solo dentro de su viewport.
    this.renderer.setScissorTest(true)
    // Flujo de color y tono para un aspecto más natural en la TV: salida en sRGB
    // y `tone mapping` ACESFilmic, que comprime altas luces y suaviza el color
    // (evita el aspecto plano/quemado del render lineal sin mapeo). La exposición
    // se sube ligeramente para compensar la compresión de ACES.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
  }

  // Contexto perdido: detén el bucle (Three ya no puede dibujar) y avisa.
  private handleContextLost(): void {
    this.stop()
    this.onContextLost?.()
  }

  // Contexto restaurado: reaplica la configuración GL, reencaja el tamaño y
  // reanuda el bucle. Three re-sube sus recursos (texturas, geometrías) de forma
  // perezosa al volver a dibujar; aquí solo hay que reestablecer el estado del
  // renderer. Si algo de esto falla, `contextRecovery` recarga como último recurso.
  private handleContextRestored(): void {
    this.configureRenderer()
    this.resize(window.innerWidth, window.innerHeight)
    this.start()
    this.onContextRestored?.()
  }

  /** Canvas del renderer. Insértalo en el DOM. */
  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  /** Fija las pistas a dibujar y recalcula la rejilla. */
  setViews(views: CourtView[]): void {
    this.views = views
    this.layout()
  }

  /** Ajusta el tamaño del canvas y recalcula la rejilla (p. ej. al redimensionar). */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height)
    this.layout()
  }

  // Recalcula el viewport de cada celda y reencuadra su cámara al aspecto real.
  private layout(): void {
    const size = this.renderer.getSize(new THREE.Vector2())
    this.viewports = computeViewports(this.views.length, size.x, size.y)
    this.viewports.forEach((vp, i) => {
      this.views[i].frame(vp.width / vp.height)
    })
  }

  /** Avanza la animación de todas las pistas (micro-movimiento de jugadores). */
  update(delta: number): void {
    for (const view of this.views) view.update(delta)
  }

  /** Dibuja un fotograma: cada pista en su celda. */
  render(): void {
    for (let i = 0; i < this.views.length; i++) {
      const vp = this.viewports[i]
      const view = this.views[i]
      this.renderer.setViewport(vp.x, vp.y, vp.width, vp.height)
      this.renderer.setScissor(vp.x, vp.y, vp.width, vp.height)
      this.renderer.render(view.scene, view.camera)
    }
  }

  /**
   * Arranca el bucle de render con `requestAnimationFrame`. Idempotente: llamarlo
   * con el bucle ya en marcha no crea un segundo bucle (evita `rAF` duplicados al
   * reanudar tras recuperar el contexto).
   */
  start(): void {
    if (this.running) return
    this.running = true
    this.clock.start()
    const loop = (): void => {
      this.frameHandle = requestAnimationFrame(loop)
      this.update(this.clock.getDelta())
      this.render()
    }
    loop()
  }

  /** Detiene el bucle de render. */
  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frameHandle)
  }

  /** Detiene el bucle, retira los listeners de contexto y libera el renderer. */
  dispose(): void {
    this.stop()
    this.recovery.uninstall()
    this.renderer.dispose()
  }
}
