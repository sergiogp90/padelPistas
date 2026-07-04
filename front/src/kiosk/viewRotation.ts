// Rotación automática de vistas para la TV: alterna una vista GLOBAL (la rejilla
// con todas las pistas) con la vista INDIVIDUAL de cada pista a pantalla completa,
// avanzando sola cada cierto intervalo (30 s por defecto):
//
//   global → pista 0 → pista 1 → ... → pista N-1 → global → ...
//
// Este módulo contiene solo la máquina de estados y su temporizador —sin Three.js,
// DOM de layout ni marcadores— y notifica cada cambio de vista por un callback,
// de modo que quien lo use (`main.ts`) decide cómo dibujar cada estado. Así la
// lógica del ciclo se prueba de forma aislada (ver `viewRotation.test.ts`), igual
// que `gridLayout`. El documento se inyecta para poder pausar con la visibilidad
// de la página y dar dobles en los tests, como en `wakeLock`.

/**
 * Intervalo por defecto (ms) que permanece cada vista antes de rotar a la
 * siguiente. Punto único para ajustar el ritmo de la rotación.
 */
export const ROTATION_INTERVAL_MS = 30_000

/**
 * Vista mostrada en un instante del ciclo: la global (todas las pistas) o una
 * pista individual, identificada por su índice (0..N-1).
 */
export type RotationView =
  | { kind: 'global' }
  | { kind: 'court'; index: number }

/**
 * Construye el ciclo de rotación para `courtCount` pistas: la vista global
 * seguida de una vista individual por pista, en orden. Al llegar al final se
 * vuelve a la global (la rotación es circular). Con 0 pistas el ciclo es solo la
 * vista global.
 *
 * Ejemplo (2 pistas): `[global, pista 0, pista 1]`.
 */
export function buildRotationCycle(courtCount: number): RotationView[] {
  const cycle: RotationView[] = [{ kind: 'global' }]
  for (let i = 0; i < courtCount; i++) cycle.push({ kind: 'court', index: i })
  return cycle
}

export interface ViewRotationOptions {
  /** Número de pistas del ciclo (una vista individual por pista). */
  courtCount: number
  /** Milisegundos por vista antes de rotar. Por defecto `ROTATION_INTERVAL_MS`. */
  intervalMs?: number
  /** Se invoca con la vista activa: una vez al arrancar y en cada cambio. */
  onChange: (view: RotationView) => void
  /** Documento cuya visibilidad pausa/reanuda la rotación (inyectable en tests). */
  doc?: Document
}

export interface ViewRotation {
  /** Vista mostrada ahora mismo. */
  readonly current: RotationView
  /** Detiene la rotación y retira el listener de visibilidad. */
  stop(): void
}

/**
 * Arranca la rotación automática de vistas. Emite la vista inicial (global) de
 * inmediato por `onChange` y, a partir de ahí, rota a la siguiente cada
 * `intervalMs`.
 *
 * Pausa/reanudación: mientras la página está oculta (otra pestaña, TV apagando
 * el navegador…) se detiene el temporizador y no se avanza; al volver a
 * `visible` se rearma la cuenta entera, de modo que la vista actual disfruta de
 * un intervalo completo en vez de saltar nada más reaparecer.
 */
export function createViewRotation(options: ViewRotationOptions): ViewRotation {
  const { courtCount, onChange } = options
  const intervalMs = options.intervalMs ?? ROTATION_INTERVAL_MS
  const doc = options.doc ?? document
  const cycle = buildRotationCycle(courtCount)

  let index = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false

  const clear = (): void => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  const advance = (): void => {
    index = (index + 1) % cycle.length
    onChange(cycle[index])
  }

  // (Re)arma la cuenta de intervalos partiendo de cero. Se reinicia entera al
  // reanudar para que una vista no rote nada más volver la página a primer plano.
  const arm = (): void => {
    clear()
    timer = setInterval(advance, intervalMs)
  }

  const onVisibilityChange = (): void => {
    if (stopped) return
    if (doc.visibilityState === 'hidden') clear()
    else arm()
  }

  doc.addEventListener('visibilitychange', onVisibilityChange)
  // Muestra la vista inicial (global) ya, y arranca el temporizador salvo que la
  // página nazca oculta; en ese caso esperará al primer `visibilitychange`.
  onChange(cycle[index])
  if (doc.visibilityState !== 'hidden') arm()

  return {
    get current() {
      return cycle[index]
    },
    stop() {
      stopped = true
      clear()
      doc.removeEventListener('visibilitychange', onVisibilityChange)
    },
  }
}
