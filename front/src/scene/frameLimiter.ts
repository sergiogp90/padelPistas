// Limitador de la tasa de fotogramas (cap de FPS) del bucle de render.
//
// `requestAnimationFrame` dispara a la frecuencia del display: 60 Hz en un panel
// normal, o mucho más en uno de alta tasa. Pintar en cada disparo gasta GPU y
// energía sin una mejora perceptible en una señalética de pistas. Este limitador
// acumula el tiempo transcurrido y solo autoriza a pintar cuando ha pasado el
// intervalo objetivo.
//
// Dos contadores separados, porque hacen cosas distintas:
//   - «cadencia»: decide CUÁNDO pintar. Arrastra el excedente sobre el intervalo
//     (no lo descarta), de modo que la media a largo plazo coincide con el
//     objetivo y no aparece un «efecto de batido» que baje los FPS reales por
//     debajo del objetivo cuando este no divide exacto la tasa del display.
//   - «tiempo desde el último fotograma»: es el paso de tiempo que se aplica a la
//     animación al pintar. Al ser el tiempo real transcurrido (incluidos los
//     disparos que se saltaron), la animación avanza igual sea cual sea la tasa
//     de pintado: el movimiento es independiente de los FPS.

/**
 * Limita la tasa de fotogramas a `targetFps` manteniendo un paso de tiempo
 * independiente de la tasa de refresco real. Sin estado global: cada bucle de
 * render usa su propia instancia.
 */
export class FrameLimiter {
  // Segundos entre fotogramas objetivo. 0 = sin tope (autoriza cada disparo).
  private readonly interval: number
  // Cadencia: tiempo (s) acumulado hacia el próximo fotograma; arrastra el resto.
  private cadence = 0
  // Tiempo real (s) transcurrido desde el último fotograma autorizado.
  private sinceRender = 0

  constructor(targetFps: number) {
    this.interval = targetFps > 0 ? 1 / targetFps : 0
  }

  /**
   * Registra `delta` segundos transcurridos (p. ej. `THREE.Clock.getDelta()`) y
   * decide si toca pintar. Debe llamarse en CADA disparo de `rAF` para que el
   * tiempo se contabilice de forma continua.
   *
   * Devuelve el paso de tiempo (s) a aplicar a la animación si toca pintar —el
   * tiempo real desde el último fotograma, de modo que la animación no dé saltos
   * ni se ralentice al saltarse disparos— o `null` si este disparo debe saltarse.
   */
  tick(delta: number): number | null {
    if (this.interval === 0) return delta

    this.cadence += delta
    this.sinceRender += delta
    if (this.cadence < this.interval) return null

    // Arrastra el excedente sobre el intervalo para que la media a largo plazo
    // case con el objetivo (evita el batido). Pero si el excedente supera un
    // intervalo entero —el bucle estuvo parado mucho rato o llegó un `delta`
    // enorme— se descarta la deuda: así no se dispara una ráfaga de fotogramas
    // para "ponerse al día" al reanudar.
    const leftover = this.cadence - this.interval
    this.cadence = leftover > this.interval ? 0 : leftover
    const step = this.sinceRender
    this.sinceRender = 0
    return step
  }

  /**
   * Descarta el tiempo acumulado. Se llama al (re)anudar el bucle para que el
   * primer fotograma tras una pausa no arrastre el tiempo transcurrido mientras
   * estaba parado (se reanuda sin saltos).
   */
  reset(): void {
    this.cadence = 0
    this.sinceRender = 0
  }
}
