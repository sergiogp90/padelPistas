import './style.css'
import { CourtView } from './scene/CourtView'
import { assignTeamColors } from './scene/teamColors'
import { MultiCourtRenderer } from './scene/MultiCourtRenderer'
import { gridShape } from './scene/gridLayout'
import { createMockDataSources } from './data/createMockDataSources'
import { startKioskMode } from './kiosk'
import { createViewRotation, type RotationView } from './kiosk/viewRotation'
import { installGlobalErrorHandlers } from './resilience/globalErrorHandlers'
import { createRenderWatchdog } from './resilience/renderWatchdog'
import { ERROR_OVERLAY_TIMEOUT_MS } from './resilience/config'

// Número de pistas a mostrar en la rejilla multipista.
const COURT_COUNT = 4

// Una fuente de datos y una vista por pista. Cada `CourtView` es autocontenida
// (su escena, su cámara y su marcador); el renderer las dibuja en un único canvas.
// A cada pista se le asigna un par de colores único para que ningún color de
// equipo se repita entre pistas distintas.
const sources = createMockDataSources(COURT_COUNT)
const teamColors = assignTeamColors(COURT_COUNT)
const views = sources.map(
  (source, i) => new CourtView(source, {}, { teamColors: teamColors[i] }),
)

// Aviso discreto mientras se recupera el contexto WebGL (ver `contextRecovery`).
// Nace oculto; el renderer lo muestra al perder el contexto y lo retira al
// reanudar. No bloquea la pantalla: es una banda pequeña en una esquina.
const contextNotice = document.createElement('div')
contextNotice.className = 'context-notice'
contextNotice.hidden = true
contextNotice.textContent = 'Recuperando la vista 3D…'
document.body.appendChild(contextNotice)

const app = new MultiCourtRenderer({
  onContextLost: () => {
    contextNotice.hidden = false
  },
  onContextRestored: () => {
    contextNotice.hidden = true
  },
})
document.body.appendChild(app.domElement)

// Marcadores overlay: una rejilla CSS a pantalla completa con la misma forma
// (columnas × filas) que usa el renderer para los viewports. El navegador
// reparte las celdas —que se autoubican en el mismo orden en que se pintan las
// pistas—, así que aquí basta con fijar `--cols`/`--rows` y meter un marcador
// por celda; la aritmética de la rejilla no se duplica. Cada celda es un
// contenedor de consulta y el marcador se dimensiona con unidades `cqw`
// (relativas al ancho de la celda), así que encaja solo sin escalado desde JS.
const grid = document.createElement('div')
grid.className = 'courts-grid'
document.body.appendChild(grid)

/**
 * Pinta el estado de rotación actual: la vista global muestra las N pistas y la
 * individual una sola a pantalla completa. En ambos casos se reutiliza la misma
 * maquinaria —`setViews` reparte el canvas con `gridLayout` (para la individual,
 * una rejilla de 1 celda = viewport a pantalla completa) y el overlay CSS se
 * dibuja con la misma forma— en lugar de duplicar lógica de layout. Con 1 celda
 * `1cqw == 1vw`, así que el marcador de la pista destacada sale ampliado solo.
 *
 * El overlay se reconstruye moviendo los `scoreboardEl` (que son de cada
 * `CourtView` y persisten), así que cambiar de vista no crea ni tira marcadores:
 * transición limpia y sin fugas. Las pistas ocultas siguen recibiendo datos (su
 * marcador está al día al volver a la global); solo se congela su animación 3D.
 */
function renderView(view: RotationView): void {
  const active = view.kind === 'global' ? views : [views[view.index]]

  app.setViews(active)

  const { cols, rows } = gridShape(active.length)
  grid.style.setProperty('--cols', String(cols))
  grid.style.setProperty('--rows', String(rows))
  grid.replaceChildren(
    ...active.map((v) => {
      const cell = document.createElement('div')
      cell.className = 'court-cell'
      cell.appendChild(v.scoreboardEl)
      return cell
    }),
  )
}

window.addEventListener('resize', () => {
  app.resize(window.innerWidth, window.innerHeight)
})

app.start()

// Red de seguridad para el funcionamiento desatendido (ver `src/resilience`).
//
// Overlay de error discreto: una banda en la esquina inferior izquierda que se
// muestra unos segundos ante un incidente y se retira sola, para no dejar texto
// fijo sobre la imagen de la TV. Es no invasivo y opcional (solo aparece si algo
// falla).
const errorNotice = document.createElement('div')
errorNotice.className = 'error-notice'
errorNotice.hidden = true
document.body.appendChild(errorNotice)

let errorNoticeTimer: ReturnType<typeof setTimeout> | undefined
function flashErrorNotice(message: string): void {
  errorNotice.textContent = message
  errorNotice.hidden = false
  clearTimeout(errorNoticeTimer)
  errorNoticeTimer = setTimeout(() => {
    errorNotice.hidden = true
  }, ERROR_OVERLAY_TIMEOUT_MS)
}

// Captura global de errores: registra excepciones no controladas y promesas
// rechazadas sin `catch` sin romper la app, y las asoma en el overlay.
installGlobalErrorHandlers({
  onError: () => flashErrorNotice('Se ha registrado un error; la vista sigue activa.'),
})

// Watchdog del bucle: si dejan de pintarse fotogramas, reinicia el bucle y, tras
// varios intentos infructuosos, recarga la página. Así una excepción dentro del
// bucle no deja la pantalla congelada.
createRenderWatchdog({
  getFrameCount: () => app.frames,
  restart: () => app.restart(),
  onStall: (stall) =>
    flashErrorNotice(
      stall.reloading
        ? 'Recuperando la vista (recargando)…'
        : 'Reanudando la vista 3D…',
    ),
  onRecover: () => {
    errorNotice.hidden = true
  },
})

// Modo kiosko: pantalla completa, cursor oculto, sin scroll/selección y sin que
// la TV entre en reposo. Se activa siempre; cada pieza degrada con elegancia si
// su API no está disponible en el navegador.
startKioskMode()

// Rotación automática de vistas para la TV: global → cada pista a pantalla
// completa → global, cambiando cada 30 s (ver `ROTATION_INTERVAL_MS`). Emite ya
// la vista inicial (global), por lo que dibuja la rejilla de arranque, y se pausa
// sola cuando la página deja de estar visible.
createViewRotation({ courtCount: COURT_COUNT, onChange: renderView })
