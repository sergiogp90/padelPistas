import * as THREE from 'three'

/**
 * Fondo de cielo en degradado vertical, del azul del cielo alto al claro del
 * horizonte. Sustituye al fondo plano anterior (`THREE.Color`) para dar ambiente
 * y una mejor sensación de profundidad a distancia (en una TV), sin coste de
 * render apreciable: es una textura pequeña que el renderer estira a pantalla.
 *
 * Se genera como `DataTexture` (bytes en crudo, sin `canvas`/DOM), de modo que
 * es instanciable y comprobable en el entorno de test (jsdom). El degradado se
 * interpola directamente sobre los valores de 8 bits en espacio sRGB y la
 * textura se marca como `SRGBColorSpace`, así los colores elegidos se muestran
 * tal cual bajo el flujo de color del renderer (sin dobles conversiones).
 */

// Colores del degradado en bytes sRGB [R, G, B]:
//  - TOP: azul del cielo en lo alto del encuadre.
//  - HORIZON: azul muy claro cerca del horizonte (parte baja del fondo).
const TOP: readonly [number, number, number] = [0x1e, 0x5f, 0xa8]
const HORIZON: readonly [number, number, number] = [0xbf, 0xe0, 0xf2]

/** Alto (en téxeles) de la textura del degradado. Ancho fijo a 1. */
const GRADIENT_HEIGHT = 256

// El degradado es idéntico para todas las pistas, así que se genera una sola vez
// y se comparte entre todas las escenas (una textura, no N).
let shared: THREE.DataTexture | null = null

/**
 * Crea la textura de degradado del cielo (una columna de `height` téxeles). La
 * fila 0 es el horizonte (abajo) y la última, el cielo alto (arriba), acorde con
 * la convención de UV de las texturas (v=0 abajo). Útil sobre todo en tests; en
 * la app usa {@link getSkyGradientTexture} para reutilizar una sola instancia.
 */
export function createSkyGradientTexture(height = GRADIENT_HEIGHT): THREE.DataTexture {
  const width = 1
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // t: 0 en el horizonte (abajo) → 1 en el cielo alto (arriba).
    const t = height > 1 ? y / (height - 1) : 1
    const i = y * 4
    data[i] = Math.round(HORIZON[0] + (TOP[0] - HORIZON[0]) * t)
    data[i + 1] = Math.round(HORIZON[1] + (TOP[1] - HORIZON[1]) * t)
    data[i + 2] = Math.round(HORIZON[2] + (TOP[2] - HORIZON[2]) * t)
    data[i + 3] = 255
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Devuelve la textura de degradado compartida, creándola la primera vez. */
export function getSkyGradientTexture(): THREE.DataTexture {
  if (!shared) shared = createSkyGradientTexture()
  return shared
}
