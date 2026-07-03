import * as THREE from 'three'
import { computeViewports, type Rect } from './gridLayout'
import { installContextRecovery, type ContextRecovery } from './contextRecovery'
import { FrameLimiter } from './frameLimiter'
import { installVisibilityPause, type VisibilityPause } from './visibilityPause'
import { MAX_PIXEL_RATIO, TARGET_FPS } from './renderConfig'
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
//
// Coste acotado (ver `renderConfig`): el bucle limita los FPS a un objetivo con
// paso de tiempo independiente (`FrameLimiter`), acota el `devicePixelRatio` y se
// pausa cuando la página no está visible (`visibilityPause`), de modo que una TV
// 4K o varias pistas no gasten GPU/energía de más ni dibujen lo que nadie ve.

/** Opciones del renderer, sobre todo avisos de pérdida/restauración de contexto. */
export interface MultiCourtRendererOptions {
  /** Se invoca al perderse el contexto WebGL (bucle ya detenido): avisa. */
  onContextLost?: () => void
  /** Se invoca al recuperarse el contexto y reanudar el bucle: retira el aviso. */
  onContextRestored?: () => void
  /** Recarga de último recurso si la restauración no es viable (inyectable en tests). */
  reload?: () => void
  /** FPS objetivo del bucle. Por defecto `TARGET_FPS`; `<= 0` desactiva el tope. */
  targetFps?: number
  /** Tope del `devicePixelRatio`. Por defecto `MAX_PIXEL_RATIO`. */
  maxPixelRatio?: number
  /** Documento cuya visibilidad pausa/reanuda el bucle (inyectable en tests). */
  doc?: Document
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
  // Contador de fotogramas pintados. Solo crece tras un `render()` con éxito, de
  // modo que si el bucle se detiene o una excepción impide pintar, se estanca y
  // el watchdog lo detecta (ver `renderWatchdog`).
  private frameCount = 0
  // Evita bucles `requestAnimationFrame` duplicados: solo hay un bucle vivo aunque
  // se reanude tras recuperar el contexto o volver de segundo plano.
  private running = false
  // Intención de estar animando (lo pidió `start()`), independiente de si el bucle
  // corre ahora mismo: mientras la página está oculta se pausa `running` pero
  // `wantRunning` sigue en `true` para reanudar solo al volver a ser visible.
  private wantRunning = false
  private readonly recovery: ContextRecovery
  private readonly visibility: VisibilityPause
  private readonly onContextLost?: () => void
  private readonly onContextRestored?: () => void
  private readonly maxPixelRatio: number
  // Limitador de FPS: acota la tasa de pintado al objetivo con paso de tiempo
  // independiente de la tasa real (ver `FrameLimiter`).
  private readonly limiter: FrameLimiter
  // Reloj para medir el tiempo entre fotogramas y animar de forma independiente
  // de los FPS (ver `CourtView.update`).
  private readonly clock = new THREE.Clock()

  constructor(options: MultiCourtRendererOptions = {}) {
    this.onContextLost = options.onContextLost
    this.onContextRestored = options.onContextRestored
    this.maxPixelRatio = options.maxPixelRatio ?? MAX_PIXEL_RATIO
    this.limiter = new FrameLimiter(options.targetFps ?? TARGET_FPS)

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

    // Pausa el bucle cuando la página deja de verse y lo reanuda al volver, para
    // no gastar GPU/energía dibujando en segundo plano.
    this.visibility = installVisibilityPause(
      {
        onHidden: () => this.pause(),
        onVisible: () => this.resume(),
      },
      { doc: options.doc },
    )
  }

  // Aplica la configuración del renderer. Se llama al crearlo y al restaurar el
  // contexto, ya que la pérdida invalida el estado GL y hay que reestablecerlo.
  private configureRenderer(): void {
    // Acota el pixel ratio: por encima de 2 el coste se dispara (crece con su
    // cuadrado) sin mejora visible a la distancia de una TV (ver `renderConfig`).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio))
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
   *
   * Marca la intención de animar y arranca el bucle si la página está visible; si
   * está oculta, no dibuja y esperará a volver a primer plano para reanudar.
   */
  start(): void {
    this.wantRunning = true
    this.resume()
  }

  /**
   * Detiene el bucle por completo: no reanudará al volver la página a primer plano
   * (a diferencia de la pausa por visibilidad). Lo usan la pérdida de contexto y
   * `dispose`.
   */
  stop(): void {
    this.wantRunning = false
    this.pause()
  }

  // Arranca el bucle de `rAF` si procede: solo si se pidió animar (`wantRunning`),
  // no hay ya un bucle vivo y la página está visible. Reinicia reloj y limitador
  // para que el primer fotograma tras (re)anudar no arrastre el tiempo transcurrido
  // parado: se reanuda sin saltos.
  private resume(): void {
    if (this.running || !this.wantRunning || this.visibility.hidden) return
    this.running = true
    this.clock.start()
    this.limiter.reset()
    const loop = (): void => {
      // Reprograma el siguiente frame ANTES de dibujar para que una excepción al
      // actualizar/pintar no rompa la cadena de `rAF`; el fotograma no llega a
      // contarse, así que el watchdog detecta el estancamiento y reanima el bucle.
      this.frameHandle = requestAnimationFrame(loop)
      // Cap de FPS: el limitador decide si toca pintar y con qué paso de tiempo.
      // Los disparos sobrantes se saltan (no cuentan como fotograma) para acotar
      // el coste al objetivo sin alterar la velocidad de la animación.
      const step = this.limiter.tick(this.clock.getDelta())
      if (step === null) return
      this.update(step)
      this.render()
      this.frameCount++
    }
    loop()
  }

  // Detiene el bucle de `rAF` en curso sin cambiar la intención de animar, de modo
  // que una pausa por visibilidad pueda reanudarse luego. `cancelAnimationFrame`
  // es inocuo si no hay frame pendiente.
  private pause(): void {
    this.running = false
    cancelAnimationFrame(this.frameHandle)
  }

  /**
   * Reinicia el bucle de render: lo detiene y lo vuelve a arrancar. A diferencia
   * de `start()` (idempotente y sin efecto si cree estar en marcha), fuerza un
   * bucle nuevo aunque el anterior siguiera marcado como activo pero atascado.
   * Es la primera medida de recuperación del watchdog.
   */
  restart(): void {
    this.stop()
    this.start()
  }

  /**
   * Nº de fotogramas pintados desde la creación del renderer. Lo consulta el
   * watchdog para comprobar que el bucle sigue vivo (ver `renderWatchdog`).
   */
  get frames(): number {
    return this.frameCount
  }

  /** Detiene el bucle, retira los listeners de contexto/visibilidad y libera el renderer. */
  dispose(): void {
    this.stop()
    this.recovery.uninstall()
    this.visibility.uninstall()
    this.renderer.dispose()
  }
}
