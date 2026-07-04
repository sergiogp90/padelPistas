import { describe, it, expect } from 'vitest'
import {
  gridShape,
  computeCssCells,
  computeViewports,
} from '../gridLayout'

/**
 * Tests de la aritmética de la rejilla multipista. Comprueban la forma de la
 * rejilla y que las celdas cubren el área sin huecos ni solapes, tanto en
 * fracciones (overlays CSS, origen arriba) como en píxeles (viewports de
 * Three.js, origen abajo).
 */

describe('gridShape', () => {
  it('elige la forma más cuadrada priorizando columnas (cols >= rows)', () => {
    expect(gridShape(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridShape(2)).toEqual({ cols: 2, rows: 1 })
    expect(gridShape(3)).toEqual({ cols: 2, rows: 2 })
    expect(gridShape(4)).toEqual({ cols: 2, rows: 2 })
    expect(gridShape(6)).toEqual({ cols: 3, rows: 2 })
    expect(gridShape(9)).toEqual({ cols: 3, rows: 3 })
  })

  it('devuelve una rejilla vacía para cantidades no positivas', () => {
    expect(gridShape(0)).toEqual({ cols: 0, rows: 0 })
    expect(gridShape(-3)).toEqual({ cols: 0, rows: 0 })
  })
})

describe('computeCssCells', () => {
  it('devuelve una celda por pista', () => {
    expect(computeCssCells(4)).toHaveLength(4)
    expect(computeCssCells(0)).toEqual([])
  })

  it('rellena de izquierda a derecha y de arriba abajo', () => {
    const cells = computeCssCells(4) // rejilla 2x2
    // Celda 0: arriba-izquierda; celda 3: abajo-derecha.
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 })
    expect(cells[1]).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 })
    expect(cells[2]).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 })
    expect(cells[3]).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })
  })

  it('una sola pista ocupa toda el área', () => {
    expect(computeCssCells(1)).toEqual([
      { x: 0, y: 0, width: 1, height: 1 },
    ])
  })
})

describe('computeViewports', () => {
  it('una sola pista ocupa todo el canvas', () => {
    expect(computeViewports(1, 1920, 1080)).toEqual([
      { x: 0, y: 0, width: 1920, height: 1080 },
    ])
  })

  it('invierte el eje Y respecto a las celdas CSS (origen abajo)', () => {
    const vps = computeViewports(4, 1000, 800) // rejilla 2x2
    // La celda CSS 0 está ARRIBA-izquierda; su viewport queda ABAJO en Y=400.
    expect(vps[0]).toEqual({ x: 0, y: 400, width: 500, height: 400 })
    // La celda CSS 2 está ABAJO-izquierda; su viewport queda en Y=0.
    expect(vps[2]).toEqual({ x: 0, y: 0, width: 500, height: 400 })
  })

  it('las celdas casan sin huecos ni solapes aunque no divida exacto', () => {
    const w = 1001
    const h = 803
    const vps = computeViewports(4, w, h)
    // Columnas contiguas: el borde derecho de una celda es el izquierdo de la otra.
    expect(vps[0].x + vps[0].width).toBe(vps[1].x)
    // Los viewports de la columna izquierda cubren toda la altura sin hueco.
    expect(vps[0].y).toBe(vps[2].y + vps[2].height)
    // El borde derecho de la última columna llega exactamente al ancho total.
    expect(vps[1].x + vps[1].width).toBe(w)
  })
})
