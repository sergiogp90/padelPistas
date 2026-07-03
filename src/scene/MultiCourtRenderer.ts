import * as THREE from 'three'
import { computeViewports, type Rect } from './gridLayout'
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

/**
 * Orquesta el dibujado de N `CourtView` en un único canvas. Reparte la pantalla
 * en una rejilla de celdas (ver `gridLayout`) y renderiza cada vista en la suya.
 */
export class MultiCourtRenderer {
  readonly renderer: THREE.WebGLRenderer

  private views: CourtView[] = []
  private viewports: Rect[] = []
  private frameHandle = 0
  // Reloj para medir el tiempo entre fotogramas y animar de forma independiente
  // de los FPS (ver `CourtView.update`).
  private readonly clock = new THREE.Clock()

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
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
    this.resize(window.innerWidth, window.innerHeight)
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

  /** Arranca el bucle de render con `requestAnimationFrame`. */
  start(): void {
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
    cancelAnimationFrame(this.frameHandle)
  }
}
