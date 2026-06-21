import * as THREE from 'three'

// Real padel court dimensions in meters
const COURT_LENGTH = 20
const COURT_WIDTH = 10
const HL = COURT_LENGTH / 2  // 10
const HW = COURT_WIDTH / 2   // 5

const NET_HEIGHT_CENTER = 0.88
const NET_HEIGHT_POST = 0.92
const SERVICE_LINE_Z = 6.95
const LINE_WIDTH = 0.05
const LINE_THICKNESS = 0.005

// Back glass (cristal trasero)
const BACK_GLASS_H = 3
const BACK_FENCE_H = 1   // reja 4m: 1m on top of back glass → total 4m

// Lateral glass 1: 2m × 3m at back corners, + 1m fence on top (same reja 4m)
const LAT1_LEN = 2
const LAT1_H = 3
const LAT1_FENCE_H = 1

// Lateral glass 2: 2m × 2m adjacent to lat1, + 1m fence on top
const LAT2_LEN = 2
const LAT2_H = 2
const LAT2_FENCE_H = 1

// Reja lateral: 3m tall, 12m total (Z=-6 to Z=+6)
// Layout per side: lat1(2m) + lat2(2m) + reja(12m) + lat2(2m) + lat1(2m) = 20m
const REJA_LEN = 12
const REJA_H = 3
const REJA_Z_END = REJA_LEN / 2  // 6

// Door in reja lateral: 1m wide × 2.2m tall, centered at Z=0 (net position)
const DOOR_W = 1
const DOOR_H = 2.2

// Spotlight poles: 6m tall at each lat2/reja junction (Z=±6, X=±5)
const POLE_H = 6

// Shared materials
const glassMat = new THREE.MeshPhongMaterial({
  color: 0x88ccff,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
})

const fenceMat = new THREE.MeshPhongMaterial({
  color: 0x555555,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
})

const metalMat = new THREE.MeshPhongMaterial({ color: 0x888888 })

const lampMat = new THREE.MeshPhongMaterial({
  color: 0xffffcc,
  emissive: 0xffffcc,
  emissiveIntensity: 0.8,
})

export class PadelCourt extends THREE.Group {
  constructor() {
    super()
    this.add(buildFloor())
    this.add(buildLines())
    this.add(buildNet())
    this.add(buildBackWalls())
    this.add(buildLateralGlass1())
    this.add(buildLateralGlass2())
    this.add(buildSideFence())
    this.add(buildSpotlightPoles())
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

  // Perimeter lines
  group.add(makeLine(-HW, 0, LINE_WIDTH, COURT_LENGTH))
  group.add(makeLine(HW, 0, LINE_WIDTH, COURT_LENGTH))
  group.add(makeLine(0, -HL, COURT_WIDTH, LINE_WIDTH))
  group.add(makeLine(0, HL, COURT_WIDTH, LINE_WIDTH))

  // Service lines (6.95m from net, each side)
  group.add(makeLine(0, -SERVICE_LINE_Z, COURT_WIDTH, LINE_WIDTH))
  group.add(makeLine(0, SERVICE_LINE_Z, COURT_WIDTH, LINE_WIDTH))

  // Center service line
  group.add(makeLine(0, 0, LINE_WIDTH, SERVICE_LINE_Z * 2))

  return group
}

function buildNet(): THREE.Group {
  const group = new THREE.Group()

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

  const bandGeo = new THREE.BoxGeometry(COURT_WIDTH, 0.06, 0.03)
  const bandMat = new THREE.MeshPhongMaterial({ color: 0xffffff })
  const band = new THREE.Mesh(bandGeo, bandMat)
  band.position.set(0, NET_HEIGHT_CENTER, 0)
  group.add(band)

  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, NET_HEIGHT_POST, 8)
  const postMat = new THREE.MeshPhongMaterial({ color: 0x666666 })
  for (const x of [-HW, HW]) {
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(x, NET_HEIGHT_POST / 2, 0)
    group.add(post)
  }

  return group
}

function buildBackWalls(): THREE.Group {
  // Cristal trasero: 10m wide, 3m glass + 1m fence on top (reja 4m → total 4m height)
  const group = new THREE.Group()
  const glassGeo = new THREE.BoxGeometry(COURT_WIDTH, BACK_GLASS_H, 0.05)
  const fenceGeo = new THREE.BoxGeometry(COURT_WIDTH, BACK_FENCE_H, 0.05)

  for (const z of [-HL, HL]) {
    const glass = new THREE.Mesh(glassGeo, glassMat)
    glass.position.set(0, BACK_GLASS_H / 2, z)
    group.add(glass)

    const fence = new THREE.Mesh(fenceGeo, fenceMat)
    fence.position.set(0, BACK_GLASS_H + BACK_FENCE_H / 2, z)
    group.add(fence)
  }

  return group
}

function buildLateralGlass1(): THREE.Group {
  // Cristal lateral 1: 2m × 3m at each back corner, both sides
  // + 1m fence on top (part of reja 4m)
  // Positions: Z = ±9 (center of the 2m panel starting at ±10)
  const group = new THREE.Group()
  const centerNear = -(HL - LAT1_LEN / 2)  // -9
  const centerFar = HL - LAT1_LEN / 2       // +9

  const glassGeo = new THREE.BoxGeometry(0.05, LAT1_H, LAT1_LEN)
  const fenceGeo = new THREE.BoxGeometry(0.05, LAT1_FENCE_H, LAT1_LEN)

  for (const x of [-HW, HW]) {
    for (const z of [centerNear, centerFar]) {
      const glass = new THREE.Mesh(glassGeo, glassMat)
      glass.position.set(x, LAT1_H / 2, z)
      group.add(glass)

      const fence = new THREE.Mesh(fenceGeo, fenceMat)
      fence.position.set(x, LAT1_H + LAT1_FENCE_H / 2, z)
      group.add(fence)
    }
  }

  return group
}

function buildLateralGlass2(): THREE.Group {
  // Cristal lateral 2: 2m × 2m adjacent inward to lat1, both sides
  // + 1m fence on top
  // Positions: Z = ±7 (center of the 2m panel from ±8 to ±6)
  const group = new THREE.Group()
  const centerNear = -(HL - LAT1_LEN - LAT2_LEN / 2)  // -7
  const centerFar = HL - LAT1_LEN - LAT2_LEN / 2       // +7

  const glassGeo = new THREE.BoxGeometry(0.05, LAT2_H, LAT2_LEN)
  const fenceGeo = new THREE.BoxGeometry(0.05, LAT2_FENCE_H, LAT2_LEN)

  for (const x of [-HW, HW]) {
    for (const z of [centerNear, centerFar]) {
      const glass = new THREE.Mesh(glassGeo, glassMat)
      glass.position.set(x, LAT2_H / 2, z)
      group.add(glass)

      const fence = new THREE.Mesh(fenceGeo, fenceMat)
      fence.position.set(x, LAT2_H + LAT2_FENCE_H / 2, z)
      group.add(fence)
    }
  }

  return group
}

function buildSideFence(): THREE.Group {
  // Reja lateral: 3m tall, 12m total (Z=-6 to Z=+6), both sides
  // Door gap: 1m wide × 2.2m tall at Z=0 (aligned with net)
  const group = new THREE.Group()

  const halfDoor = DOOR_W / 2                   // 0.5
  const segLen = REJA_Z_END - halfDoor           // 5.5m each segment
  const leftCenterZ = -(halfDoor + segLen / 2)  // -3.25
  const rightCenterZ = halfDoor + segLen / 2    // +3.25
  const aboveH = REJA_H - DOOR_H                // 0.8m above door

  const segGeo = new THREE.BoxGeometry(0.05, REJA_H, segLen)
  const aboveGeo = new THREE.BoxGeometry(0.05, aboveH, DOOR_W)
  const doorPostGeo = new THREE.CylinderGeometry(0.03, 0.03, DOOR_H, 6)

  for (const x of [-HW, HW]) {
    const leftSeg = new THREE.Mesh(segGeo, fenceMat)
    leftSeg.position.set(x, REJA_H / 2, leftCenterZ)
    group.add(leftSeg)

    const rightSeg = new THREE.Mesh(segGeo, fenceMat)
    rightSeg.position.set(x, REJA_H / 2, rightCenterZ)
    group.add(rightSeg)

    // Fence section above the door opening
    const aboveDoor = new THREE.Mesh(aboveGeo, fenceMat)
    aboveDoor.position.set(x, DOOR_H + aboveH / 2, 0)
    group.add(aboveDoor)

    // Door frame posts at each side of the opening
    for (const dz of [-halfDoor, halfDoor]) {
      const post = new THREE.Mesh(doorPostGeo, metalMat)
      post.position.set(x, DOOR_H / 2, dz)
      group.add(post)
    }
  }

  return group
}

function buildSpotlightPoles(): THREE.Group {
  // 4 poles (one per lat2/reja junction): X=±5, Z=±6
  // Each pole: 6m tall with 4 lamp fixtures at the top
  const group = new THREE.Group()

  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, POLE_H, 8)
  const lampGeo = new THREE.BoxGeometry(0.25, 0.12, 0.15)

  for (const x of [-HW, HW]) {
    for (const z of [-REJA_Z_END, REJA_Z_END]) {
      const pole = new THREE.Mesh(poleGeo, metalMat)
      pole.position.set(x, POLE_H / 2, z)
      group.add(pole)

      // 4 lamp fixtures spread at top of pole pointing toward court interior
      const lampOffsets = [
        { dx: 0.25, dz: 0.25 },
        { dx: -0.25, dz: 0.25 },
        { dx: 0.25, dz: -0.25 },
        { dx: -0.25, dz: -0.25 },
      ]
      for (const off of lampOffsets) {
        const lamp = new THREE.Mesh(lampGeo, lampMat)
        lamp.position.set(x + off.dx, POLE_H - 0.1, z + off.dz)
        group.add(lamp)
      }

      // Point light to illuminate the court from this pole
      const light = new THREE.PointLight(0xfffde0, 0.8, 30)
      light.position.set(x, POLE_H, z)
      group.add(light)
    }
  }

  return group
}
