import * as THREE from 'three'

// Real padel court dimensions in meters
const COURT_LENGTH = 20
const COURT_WIDTH = 10
const WALL_HEIGHT = 3
const NET_HEIGHT_CENTER = 0.88
const NET_HEIGHT_POST = 0.92
const SERVICE_LINE_Z = 6.95
const LINE_WIDTH = 0.05
const LINE_THICKNESS = 0.005

export class PadelCourt extends THREE.Group {
  constructor() {
    super()
    this.add(buildFloor())
    this.add(buildLines())
    this.add(buildNet())
    this.add(buildBackWalls())
  }
}

function buildFloor(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH)
  const mat = new THREE.MeshPhongMaterial({ color: 0x1a5c2a })
  const floor = new THREE.Mesh(geo, mat)
  floor.rotation.x = -Math.PI / 2
  return floor
}

function makeLine(x: number, z: number, width: number, depth: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, LINE_THICKNESS, depth)
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, LINE_THICKNESS / 2, z)
  return mesh
}

function buildLines(): THREE.Group {
  const group = new THREE.Group()
  const hw = COURT_WIDTH / 2
  const hl = COURT_LENGTH / 2

  // Perimeter lines
  group.add(makeLine(-hw, 0, LINE_WIDTH, COURT_LENGTH))   // left sideline
  group.add(makeLine(hw, 0, LINE_WIDTH, COURT_LENGTH))    // right sideline
  group.add(makeLine(0, -hl, COURT_WIDTH, LINE_WIDTH))    // near end line
  group.add(makeLine(0, hl, COURT_WIDTH, LINE_WIDTH))     // far end line

  // Service lines (6.95m from net, each side)
  group.add(makeLine(0, -SERVICE_LINE_Z, COURT_WIDTH, LINE_WIDTH))
  group.add(makeLine(0, SERVICE_LINE_Z, COURT_WIDTH, LINE_WIDTH))

  // Center service line (between service lines, along the net axis)
  group.add(makeLine(0, 0, LINE_WIDTH, SERVICE_LINE_Z * 2))

  return group
}

function buildNet(): THREE.Group {
  const group = new THREE.Group()
  const hw = COURT_WIDTH / 2

  // Net mesh
  const netGeo = new THREE.PlaneGeometry(COURT_WIDTH, NET_HEIGHT_CENTER)
  const netMat = new THREE.MeshPhongMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  })
  const net = new THREE.Mesh(netGeo, netMat)
  net.position.set(0, NET_HEIGHT_CENTER / 2, 0)
  group.add(net)

  // White top band
  const bandGeo = new THREE.BoxGeometry(COURT_WIDTH, 0.06, 0.03)
  const bandMat = new THREE.MeshPhongMaterial({ color: 0xffffff })
  const band = new THREE.Mesh(bandGeo, bandMat)
  band.position.set(0, NET_HEIGHT_CENTER, 0)
  group.add(band)

  // Net posts
  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, NET_HEIGHT_POST, 8)
  const postMat = new THREE.MeshPhongMaterial({ color: 0x666666 })
  for (const x of [-hw, hw]) {
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(x, NET_HEIGHT_POST / 2, 0)
    group.add(post)
  }

  return group
}

function buildBackWalls(): THREE.Group {
  const group = new THREE.Group()
  const hl = COURT_LENGTH / 2

  const wallGeo = new THREE.PlaneGeometry(COURT_WIDTH, WALL_HEIGHT)
  const wallMat = new THREE.MeshPhongMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  })

  const wallNear = new THREE.Mesh(wallGeo, wallMat)
  wallNear.position.set(0, WALL_HEIGHT / 2, -hl)
  group.add(wallNear)

  const wallFar = new THREE.Mesh(wallGeo, wallMat)
  wallFar.position.set(0, WALL_HEIGHT / 2, hl)
  group.add(wallFar)

  return group
}
