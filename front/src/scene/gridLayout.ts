// Rejilla de celdas para la vista multipista.
//
// Renderizamos N pistas con un único `WebGLRenderer` a pantalla completa,
// dibujando cada pista en su propia región (celda) mediante `setViewport` /
// `setScissor` (patrón multi-vista estándar de Three.js). Este módulo contiene
// solo la aritmética de la rejilla —sin Three.js ni DOM— para poder probarla de
// forma aislada: dada la cantidad de pistas calcula la forma de la rejilla y la
// región de cada celda, tanto en píxeles para el renderer como en fracciones
// para maquetar los overlays HTML (marcadores).

/** Región rectangular. La interpretación del origen depende de quién la use. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Forma de la rejilla (columnas × filas) más ajustada a un cuadrado para `count`
 * celdas. Se prioriza rellenar en horizontal (`cols >= rows`), que encaja mejor
 * en pantallas apaisadas de TV. La última fila puede quedar incompleta.
 *
 * Ejemplos: 1→1×1, 2→2×1, 3→2×2, 4→2×2, 6→3×2, 9→3×3.
 */
export function gridShape(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 0, rows: 0 }
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  return { cols, rows }
}

/**
 * Celdas de la rejilla como fracciones [0..1] del área total, con el origen
 * ARRIBA a la izquierda (convención CSS/DOM). Se rellenan de izquierda a derecha
 * y de arriba abajo: la celda `i` ocupa fila `floor(i / cols)`, columna
 * `i % cols`.
 */
export function computeCssCells(count: number): Rect[] {
  const { cols, rows } = gridShape(count)
  if (cols === 0) return []
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: col / cols,
      y: row / rows,
      width: 1 / cols,
      height: 1 / rows,
    }
  })
}

/**
 * Viewports en píxeles para `WebGLRenderer.setViewport` / `setScissor`, cuyo
 * origen está ABAJO a la izquierda (por eso el eje Y se invierte respecto a las
 * celdas CSS). Los bordes se redondean al píxel para que las celdas contiguas
 * casen sin costuras ni solapes.
 *
 * @param count Número de pistas/celdas.
 * @param width Anchura del canvas en píxeles (CSS).
 * @param height Altura del canvas en píxeles (CSS).
 */
export function computeViewports(
  count: number,
  width: number,
  height: number,
): Rect[] {
  return computeCssCells(count).map((cell) => {
    const left = Math.round(cell.x * width)
    const right = Math.round((cell.x + cell.width) * width)
    const top = Math.round(cell.y * height)
    const bottom = Math.round((cell.y + cell.height) * height)
    return {
      x: left,
      // Convertir de origen-arriba (CSS) a origen-abajo (Three.js).
      y: height - bottom,
      width: right - left,
      height: bottom - top,
    }
  })
}
