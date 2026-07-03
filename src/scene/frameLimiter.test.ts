import { describe, it, expect } from 'vitest'
import { FrameLimiter } from './frameLimiter'

/**
 * Tests del limitador de FPS. Comprueban que autoriza a pintar a la cadencia
 * objetivo (saltando los disparos sobrantes de un display más rápido), que el
 * paso de tiempo devuelto es el tiempo REAL transcurrido —para que la animación
 * no se ralentice al saltarse disparos— y que reanuda sin arrastrar el tiempo de
 * una pausa.
 */

// Un fotograma de un display a 60 Hz, en segundos (lo que devolvería `getDelta`).
const FRAME_60HZ = 1 / 60

describe('FrameLimiter', () => {
  it('a 30 FPS objetivo pinta uno de cada dos disparos de un display a 60 Hz', () => {
    const limiter = new FrameLimiter(30)
    const results = Array.from({ length: 6 }, () => limiter.tick(FRAME_60HZ))

    // null = disparo saltado; número = fotograma autorizado (uno sí, uno no).
    const painted = results.map((step) => step !== null)
    expect(painted).toEqual([false, true, false, true, false, true])
  })

  it('mantiene la media en el objetivo aunque el objetivo no divida la tasa (sin batido)', () => {
    // 50 FPS objetivo sobre un display a 60 Hz no encaja en un patrón exacto; el
    // arrastre del excedente debe dar ~50 fotogramas en un segundo, no 30 ni 60.
    const limiter = new FrameLimiter(50)
    let painted = 0
    // Un segundo de disparos a 60 Hz.
    for (let i = 0; i < 60; i++) {
      if (limiter.tick(FRAME_60HZ) !== null) painted++
    }
    // Cerca de 50 (tolerancia por el redondeo del reparto de disparos).
    expect(painted).toBeGreaterThanOrEqual(49)
    expect(painted).toBeLessThanOrEqual(51)
  })

  it('el paso de tiempo devuelto es el tiempo real desde el último fotograma', () => {
    const limiter = new FrameLimiter(30)

    expect(limiter.tick(FRAME_60HZ)).toBeNull() // acumula ~16,7 ms
    const step = limiter.tick(FRAME_60HZ) // pinta: han pasado ~33,3 ms reales

    expect(step).not.toBeNull()
    // Dos fotogramas de 60 Hz ≈ un fotograma de 30 FPS: la animación avanza por el
    // tiempo real transcurrido, no por el intervalo objetivo.
    expect(step).toBeCloseTo(2 * FRAME_60HZ, 5)
  })

  it('sin tope (0) autoriza cada disparo y devuelve el delta tal cual', () => {
    const limiter = new FrameLimiter(0)
    expect(limiter.tick(FRAME_60HZ)).toBe(FRAME_60HZ)
    expect(limiter.tick(0.5)).toBe(0.5)
  })

  it('un objetivo negativo también desactiva el tope', () => {
    const limiter = new FrameLimiter(-30)
    expect(limiter.tick(FRAME_60HZ)).toBe(FRAME_60HZ)
  })

  it('acota la deuda: un delta enorme pinta una sola vez, sin ráfaga posterior', () => {
    const limiter = new FrameLimiter(30)

    // Un salto de 1 s (p. ej. el bucle estuvo bloqueado) pinta un fotograma...
    expect(limiter.tick(1)).not.toBeNull()
    // ...pero el siguiente disparo normal se salta: no hay deuda acumulada que
    // dispare una ráfaga de fotogramas para "ponerse al día".
    expect(limiter.tick(FRAME_60HZ)).toBeNull()
  })

  it('reset descarta el tiempo acumulado para reanudar sin saltos', () => {
    const limiter = new FrameLimiter(30)

    limiter.tick(FRAME_60HZ) // acumula algo por debajo del intervalo
    limiter.reset()

    // Tras reanudar, un solo disparo no basta para pintar (empieza de cero); no
    // arrastra lo acumulado antes de la pausa.
    expect(limiter.tick(FRAME_60HZ)).toBeNull()
    const step = limiter.tick(FRAME_60HZ)
    expect(step).not.toBeNull()
    // El paso solo cuenta el tiempo desde el reset, no el de antes.
    expect(step).toBeCloseTo(2 * FRAME_60HZ, 5)
  })
})
