import './style.css'
import * as THREE from 'three'
import { PadelCourt } from './scene/PadelCourt'
import { createCamera, frameCourt } from './scene/createCamera'
import { mountScoreboard } from './ui/Scoreboard'
import { MockDataSource } from './data/MockDataSource'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)

const camera = createCamera(window.innerWidth / window.innerHeight)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Marcador overlay (HTML/CSS sobre el canvas), alimentado por un `DataSource`.
// La UI no conoce el origen de los datos: se suscribe y se re-renderiza sola
// según avanza el partido simulado.
const dataSource = new MockDataSource()
document.body.appendChild(mountScoreboard(dataSource).el)
dataSource.start()

const court = new PadelCourt()
scene.add(court)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(10, 20, 10)
scene.add(directionalLight)

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
