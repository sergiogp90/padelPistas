import * as THREE from 'three'

/**
 * Sombra de contacto **falsa y barata**: un plano tumbado en el suelo con una
 * mancha oscura de bordes difusos, que se coloca bajo un jugador o la pelota
 * para darles apoyo visual (que no parezcan flotar) y reforzar la sensación de
 * profundidad. Es la alternativa económica a las sombras reales (`shadow maps`),
 * pensada para mantener los FPS con varias pistas en pantalla: no añade pasadas
 * de render ni depende de la iluminación de la escena.
 *
 * La mancha es una `DataTexture` con un degradado radial en su canal alfa
 * (opaca en el centro, transparente en el borde), generada sin `canvas`/DOM para
 * ser instanciable y comprobable en tests. La textura es idéntica para todas las
 * sombras, así que se genera una vez y se comparte.
 */

/** Resolución (lado, en téxeles) de la textura de la mancha. */
const TEXTURE_SIZE = 64

// Textura de la mancha compartida por todas las sombras (una, no N).
let sharedTexture: THREE.DataTexture | null = null

/**
 * Genera la textura radial de la mancha: negra con un degradado en el canal
 * alfa que decae del centro (opaco) al borde (transparente), con una caída
 * suave (cuadrática) para que el borde no se vea marcado.
 */
function buildShadowTexture(): THREE.DataTexture {
  const size = TEXTURE_SIZE
  const data = new Uint8Array(size * size * 4)
  const center = (size - 1) / 2
  const maxRadius = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      const d = Math.sqrt(dx * dx + dy * dy) / maxRadius
      // Caída suave: 1 en el centro → 0 en el borde, con curva cuadrática.
      const falloff = Math.max(0, 1 - d)
      const alpha = Math.round(falloff * falloff * 255)
      const i = (y * size + x) * 4
      data[i] = 0 // R
      data[i + 1] = 0 // G
      data[i + 2] = 0 // B (mancha negra)
      data[i + 3] = alpha
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

/** Devuelve la textura de mancha compartida, creándola la primera vez. */
function getShadowTexture(): THREE.DataTexture {
  if (!sharedTexture) sharedTexture = buildShadowTexture()
  return sharedTexture
}

/** Opacidad base de una sombra de contacto recién creada. */
export const CONTACT_SHADOW_BASE_OPACITY = 0.35

/**
 * Crea una sombra de contacto: un plano de lado `2·radius` tumbado sobre el
 * suelo (normal +Y), colocado apenas por encima de `y=0` para no solaparse con
 * el suelo (`z-fighting`). Usa un material básico (sin iluminación) con la
 * mancha radial como mapa y sin escritura de profundidad, de modo que se funde
 * con lo que tiene debajo. Colócala en las coordenadas de la pista bajo el
 * objeto al que da apoyo.
 *
 * @param radius Radio aproximado de la mancha en metros (por defecto 0,5).
 */
export function createContactShadow(radius = 0.5): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2)
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: getShadowTexture(),
    transparent: true,
    opacity: CONTACT_SHADOW_BASE_OPACITY,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2 // tumbado en el plano del suelo
  mesh.position.y = 0.02 // apenas por encima del suelo
  mesh.renderOrder = 1 // se dibuja tras el suelo, para mezclarse encima
  return mesh
}
