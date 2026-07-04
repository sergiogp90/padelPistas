import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createSkyGradientTexture, getSkyGradientTexture } from '../skyGradient'

/**
 * Tests estructurales del fondo de cielo en degradado.
 *
 * No comprueban el render, sino que la textura se genera con las dimensiones y
 * el degradado esperados (horizonte claro abajo, cielo azul arriba) y que la
 * variante compartida reutiliza una sola instancia.
 */
describe('skyGradient', () => {
  it('crea una DataTexture en espacio de color sRGB', () => {
    const tex = createSkyGradientTexture()
    expect(tex).toBeInstanceOf(THREE.DataTexture)
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace)
  })

  it('genera una columna de téxeles del alto indicado', () => {
    const tex = createSkyGradientTexture(16)
    expect(tex.image.width).toBe(1)
    expect(tex.image.height).toBe(16)
    expect(tex.image.data).toHaveLength(16 * 4)
  })

  it('va del horizonte claro (abajo) al cielo azul (arriba)', () => {
    const height = 32
    const tex = createSkyGradientTexture(height)
    const data = tex.image.data as Uint8Array

    // Fila 0 (abajo): horizonte claro. Última fila (arriba): cielo más oscuro.
    const bottom = [data[0], data[1], data[2]]
    const topStart = (height - 1) * 4
    const top = [data[topStart], data[topStart + 1], data[topStart + 2]]

    // El azul del cielo alto es más intenso pero más oscuro en conjunto que el
    // horizonte pálido: el brillo (suma de canales) decrece del horizonte al cielo.
    const brightness = (c: number[]) => c[0] + c[1] + c[2]
    expect(brightness(top)).toBeLessThan(brightness(bottom))
    // Y el canal alfa siempre opaco.
    expect(data[3]).toBe(255)
  })

  it('comparte una única instancia con getSkyGradientTexture', () => {
    expect(getSkyGradientTexture()).toBe(getSkyGradientTexture())
  })
})
