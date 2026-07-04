// Configuración de rendimiento del render 3D.
//
// Punto ÚNICO para ajustar los topes de coste del bucle de dibujado sin tocar su
// lógica. En una TV 4K o con varias pistas, dibujar sin límites —a la tasa del
// display y con el `devicePixelRatio` del dispositivo— gasta GPU/energía sin una
// mejora visible; estos valores acotan ese coste. Son sobreescribibles por opción
// en el renderer; aquí solo están los valores por defecto.

/**
 * Fotogramas por segundo objetivo del bucle de render. La señalética no gana
 * fluidez perceptible por encima de esto, así que se limita para ahorrar
 * GPU/energía. El paso de tiempo de la animación es independiente de este valor
 * (ver `FrameLimiter`): cambiarlo no altera la velocidad del movimiento, solo su
 * suavidad. Un valor `<= 0` desactiva el tope (pinta en cada disparo de `rAF`).
 */
export const TARGET_FPS = 30

/**
 * Tope del `devicePixelRatio` aplicado al renderer. El coste de dibujado crece
 * con el cuadrado del ratio, así que por encima de 2 se dispara sin mejora visible
 * a la distancia de una TV; limitarlo evita renderizar de más en pantallas
 * 4K/Retina donde `window.devicePixelRatio` puede ser 3 o 4.
 */
export const MAX_PIXEL_RATIO = 2
