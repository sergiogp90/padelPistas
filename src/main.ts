import './style.css'
import { CourtView } from './scene/CourtView'
import { MultiCourtRenderer } from './scene/MultiCourtRenderer'
import { computeCssCells, gridShape } from './scene/gridLayout'
import { createMockDataSources } from './data/createMockDataSources'

// Número de pistas a mostrar en la rejilla multipista.
const COURT_COUNT = 4

// Una fuente de datos y una vista por pista. Cada `CourtView` es autocontenida
// (su escena, su cámara y su marcador); el renderer las dibuja en un único canvas.
const sources = createMockDataSources(COURT_COUNT)
const views = sources.map((source) => new CourtView(source))

const app = new MultiCourtRenderer()
document.body.appendChild(app.domElement)
app.setViews(views)

// Marcadores overlay: uno por celda, colocados sobre el viewport de su pista.
// Cada marcador se envuelve en un contenedor posicionado según la celda (en %,
// origen arriba-izquierda) y se escala según el número de columnas para que
// quepa en su celda sin invadir a las vecinas.
const { cols } = gridShape(COURT_COUNT)
const cells = computeCssCells(COURT_COUNT)
views.forEach((view, i) => {
  const cell = cells[i]
  const overlay = document.createElement('div')
  overlay.className = 'court-overlay'
  overlay.style.left = `${cell.x * 100}%`
  overlay.style.top = `${cell.y * 100}%`
  overlay.style.width = `${cell.width * 100}%`
  overlay.style.height = `${cell.height * 100}%`
  overlay.style.setProperty('--court-scale', String(1 / cols))
  overlay.appendChild(view.scoreboardEl)
  document.body.appendChild(overlay)
})

window.addEventListener('resize', () => {
  app.resize(window.innerWidth, window.innerHeight)
})

app.start()
