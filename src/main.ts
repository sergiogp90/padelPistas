import './style.css'
import * as THREE from 'three'
import { PadelCourt } from './scene/PadelCourt'
import { createCamera, frameCourt } from './scene/createCamera'
import { createScoreboard } from './ui/Scoreboard'
import { mockCourt } from './data/mockCourt'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)

const camera = createCamera(window.innerWidth / window.innerHeight)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Marcador overlay (HTML/CSS sobre el canvas), alimentado por los datos mock.
document.body.appendChild(createScoreboard(mockCourt))

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
