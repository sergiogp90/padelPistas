import * as THREE from 'three'

// Cámara estilo retransmisión para encuadrar una pista de pádel.
//
// La pista mide 20 m de largo (eje Z), 10 m de ancho (eje X) y unos 4 m de alto.
// La cámara se sitúa detrás de un fondo, elevada y ligeramente desplazada de
// lado para dar perspectiva y sensación de profundidad (escorzo), igual que en
// una retransmisión de TV.

// Caja envolvente de la pista (metros) usada para calcular el encuadre.
const COURT_LENGTH = 20
const COURT_WIDTH = 10
const COURT_HEIGHT = 4

// Campo de visión vertical en grados.
const FOV = 45

// Dirección desde la que mira la cámara (de la pista hacia la cámara).
// - Componente Z: detrás de un fondo (vista a lo largo de la pista).
// - Componente Y: elevación → ángulo en picado suave, no cenital.
// - Componente X: 0 → la cámara mira la pista de frente por el eje Z, sin
//   desplazamiento lateral, de modo que la línea de fondo queda horizontal
//   (paralela al eje X de la pantalla).
const VIEW_DIR = new THREE.Vector3(0, 0.5, 1).normalize()

// Punto al que mira la cámara: centro de la pista, ligeramente elevado para
// que la pista no quede pegada al borde inferior del encuadre.
const TARGET = new THREE.Vector3(0, 1, 0)

// Margen alrededor de la pista (1 = ajuste exacto; >1 deja aire).
const FIT_MARGIN = 1.08

// Fracción de la anchura reservada a la izquierda para el marcador. La pista se
// encuadra y se centra solo en la franja derecha restante, de modo que quede
// alineada a la derecha y no tape (ni la tape) el marcador superior izquierdo.
//
// Es una fracción del encuadre, no una medida absoluta, así que aplica igual a
// nivel de CELDA: `frameCourt` usa el aspecto de la celda (`camera.aspect`, que
// el renderer fija a `ancho/alto` del viewport de la celda), y el marcador se
// dimensiona con unidades `cqw` relativas a esa misma celda. Al escalar ambos en
// proporción a la celda, la misma reserva sirve para una pista a pantalla
// completa o para N pistas en rejilla.
const LEFT_RESERVE = 0.3

// Esquinas de la caja envolvente de la pista, relativas a TARGET.
const courtCorners: THREE.Vector3[] = []
for (const x of [-COURT_WIDTH / 2, COURT_WIDTH / 2]) {
  for (const y of [0, COURT_HEIGHT]) {
    for (const z of [-COURT_LENGTH / 2, COURT_LENGTH / 2]) {
      courtCorners.push(new THREE.Vector3(x, y, z).sub(TARGET))
    }
  }
}

/**
 * Crea la cámara de retransmisión ya encuadrada para el aspecto dado.
 */
export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
  frameCourt(camera)
  return camera
}

/**
 * Recoloca la cámara para que la pista completa quepa en el encuadre con el
 * aspecto actual de `camera`. Llamar tras cambiar `camera.aspect` (p. ej. al
 * redimensionar la ventana o al maquetar la rejilla: `camera.aspect` es el de la
 * CELDA donde se dibuja la pista, no el de la ventana; ver `CourtView.frame`).
 *
 * Mantiene la dirección y el objetivo de la cámara fijos y solo ajusta la
 * distancia, de modo que el ángulo de retransmisión se conserva en cualquier
 * relación de aspecto (apaisada o vertical).
 */
export function frameCourt(camera: THREE.PerspectiveCamera): void {
  // Base ortonormal de la cámara. forward apunta de la cámara hacia la pista.
  const worldUp = new THREE.Vector3(0, 1, 0)
  const forward = VIEW_DIR.clone().negate()
  const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize()
  const up = new THREE.Vector3().crossVectors(forward, right).normalize()

  const tanV = Math.tan(THREE.MathUtils.degToRad(FOV) / 2) / FIT_MARGIN
  const tanH = tanV * camera.aspect

  // El encuadre final aplica un paneo lateral que centra la pista en la franja
  // derecha (ver `panOffset` más abajo). Ese paneo es una traslación lateral de
  // la cámara, así que su efecto en NDC depende de la profundidad de cada
  // esquina y no puede tratarse como un simple recorte del ancho disponible.
  //
  // Modelamos el resultado directamente. Para una esquina con:
  //   s = esquina·VIEW_DIR   (profundidad a lo largo de la vista)
  //   a = esquina·right      (coordenada lateral, con signo)
  //   b = |esquina·up|       (coordenada vertical)
  // su profundidad a la cámara es (distance - s) y, tras panear, su coordenada
  // horizontal en NDC vale (a/tanH + LEFT_RESERVE·distance) / (distance - s).
  // Imponer que quede dentro de [-1, 1] en horizontal y [-1, 1] en vertical da,
  // para cada esquina, tres cotas inferiores sobre `distance`:
  //   vertical:    distance ≥ s + b/tanV
  //   borde dcho.: distance ≥ (a/tanH + s) / (1 - LEFT_RESERVE)
  //   borde izdo.: distance ≥ (s - a/tanH) / (1 + LEFT_RESERVE)
  // Tomamos el máximo sobre todas las esquinas y ambos bordes.
  let distance = 0
  for (const corner of courtCorners) {
    const s = corner.dot(VIEW_DIR)
    const a = corner.dot(right)
    const b = Math.abs(corner.dot(up))
    const vertical = s + b / tanV
    const rightEdge = (a / tanH + s) / (1 - LEFT_RESERVE)
    const leftEdge = (s - a / tanH) / (1 + LEFT_RESERVE)
    const needed = Math.max(vertical, rightEdge, leftEdge)
    if (needed > distance) distance = needed
  }

  // Desplazamiento lateral (paneo) para centrar la pista en la franja derecha.
  // `right` aquí apunta hacia la izquierda de la pantalla (es -cross(up, VIEW_DIR)),
  // así que desplazar el objetivo en esa dirección mueve el eje óptico a la
  // izquierda y la pista (centrada en TARGET) aparece desplazada a la derecha en
  // NDC justo LEFT_RESERVE.
  const panOffset = right.clone().multiplyScalar(LEFT_RESERVE * distance * tanH)
  const target = TARGET.clone().add(panOffset)

  camera.position.copy(VIEW_DIR).multiplyScalar(distance).add(target)
  camera.lookAt(target)
}
