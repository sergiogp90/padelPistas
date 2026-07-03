import './style.css'
import { CourtView } from './scene/CourtView'
import { assignTeamColors } from './scene/teamColors'
import { MultiCourtRenderer } from './scene/MultiCourtRenderer'
import { gridShape } from './scene/gridLayout'
import { createMockDataSources } from './data/createMockDataSources'
import { startKioskMode } from './kiosk'

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

const app = new MultiCourtRenderer()
document.body.appendChild(app.domElement)
app.setViews(views)

// Marcadores overlay: una rejilla CSS a pantalla completa con la misma forma
// (columnas × filas) que usa el renderer para los viewports. El navegador
// reparte las celdas —que se autoubican en el mismo orden en que se pintan las
// pistas—, así que aquí basta con fijar `--cols`/`--rows` y meter un marcador
// por celda; la aritmética de la rejilla no se duplica. Cada celda es un
// contenedor de consulta y el marcador se dimensiona con unidades `cqw`
// (relativas al ancho de la celda), así que encaja solo sin escalado desde JS.
const { cols, rows } = gridShape(COURT_COUNT)
const grid = document.createElement('div')
grid.className = 'courts-grid'
grid.style.setProperty('--cols', String(cols))
grid.style.setProperty('--rows', String(rows))
views.forEach((view) => {
  const cell = document.createElement('div')
  cell.className = 'court-cell'
  cell.appendChild(view.scoreboardEl)
  grid.appendChild(cell)
})
document.body.appendChild(grid)

window.addEventListener('resize', () => {
  app.resize(window.innerWidth, window.innerHeight)
})

app.start()

// Modo kiosko: pantalla completa, cursor oculto, sin scroll/selección y sin que
// la TV entre en reposo. Se activa siempre; cada pieza degrada con elegancia si
// su API no está disponible en el navegador.
startKioskMode()
