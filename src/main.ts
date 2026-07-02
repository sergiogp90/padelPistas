import './style.css'
import * as THREE from 'three'
import { createCamera, frameCourt } from './scene/createCamera'
import { CourtView } from './scene/CourtView'
import { MockDataSource } from './data/MockDataSource'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)

const camera = createCamera(window.innerWidth / window.innerHeight)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Luces globales de la escena, compartidas por todas las pistas.
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(10, 20, 10)
scene.add(directionalLight)

// Pista única, montada mediante `CourtView`: encapsula la pista 3D y su marcador
// overlay (alimentado por un `DataSource`). La UI no conoce el origen de los
// datos: se suscribe y se re-renderiza sola según avanza el partido simulado.
// La celda por defecto (origen) reproduce la vista actual, sin cambio visible.
const dataSource = new MockDataSource()
const courtView = new CourtView(dataSource)
scene.add(courtView.object3D)
document.body.appendChild(courtView.scoreboardEl)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  frameCourt(camera)
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

animate()
