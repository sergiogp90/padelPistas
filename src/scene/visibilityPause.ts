// Pausa/reanudación de trabajo según la visibilidad de la página.
//
// Cuando la pestaña deja de verse (otra pestaña, la TV en reposo, el navegador en
// segundo plano) no tiene sentido seguir gastando CPU/GPU dibujando lo que nadie
// ve. Este pequeño ayudante escucha `visibilitychange` y avisa a quien lo use para
// que pause al ocultarse y reanude al volver, sin duplicar el cableado del evento
// en cada módulo. El documento se inyecta para poder probarlo con un doble, igual
// que `viewRotation`, `renderWatchdog` y `contextRecovery`.

/** Callbacks invocados en cada transición de visibilidad de la página. */
export interface VisibilityPauseHandlers {
  /** La página pasa a estar oculta: conviene pausar el trabajo. */
  onHidden: () => void
  /** La página vuelve a ser visible: conviene reanudar el trabajo. */
  onVisible: () => void
}

export interface VisibilityPauseOptions {
  /** Documento cuya visibilidad se vigila (inyectable en tests). */
  doc?: Document
}

export interface VisibilityPause {
  /** `true` si la página está oculta ahora mismo. */
  readonly hidden: boolean
  /** Retira el listener de `visibilitychange`. */
  uninstall(): void
}

/**
 * Instala un listener de `visibilitychange` que invoca `onHidden`/`onVisible` en
 * cada transición. No dispara ningún callback al instalarse: solo reacciona a los
 * cambios; el estado inicial se consulta con `hidden`.
 */
export function installVisibilityPause(
  handlers: VisibilityPauseHandlers,
  options: VisibilityPauseOptions = {},
): VisibilityPause {
  const doc = options.doc ?? document
  const isHidden = (): boolean => doc.visibilityState === 'hidden'

  const onChange = (): void => {
    if (isHidden()) handlers.onHidden()
    else handlers.onVisible()
  }

  doc.addEventListener('visibilitychange', onChange)

  return {
    get hidden() {
      return isHidden()
    },
    uninstall() {
      doc.removeEventListener('visibilitychange', onChange)
    },
  }
}
