<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

const router = useRouter()
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const userName = userInfo.userName || 'admin'

const tooltip3D = ref({ show: false, x: 0, y: 0, label: '', value: '', sub: '' })

// 统计数（用于3D节点高度）
const stats = ref({ totalOrders: 0, pendingOrders: 0, pendingDelivery: 0, totalDeliveries: 0, totalReceives: 0, suppliers: 0 })

async function fetchStats() {
  const t = localStorage.getItem('token')
  const h = { 'Content-Type': 'application/json', ...(t ? { 'Authorization': `Bearer ${t}` } : {}) }
  const r = await Promise.allSettled([
    fetch('/api/Orders/GetOrdersByList', { method: 'POST', headers: h, body: '{"pageIndex":1,"pageSize":1}' }),
    fetch('/api/Orders/GetOrdersByList', { method: 'POST', headers: h, body: '{"status":0,"pageIndex":1,"pageSize":1}' }),
    fetch('/api/Orders/GetOrdersByList', { method: 'POST', headers: h, body: '{"status":2,"pageIndex":1,"pageSize":1}' }),
    fetch('/api/Delivery/GetDeliveryNote', { method: 'POST', headers: h, body: '{"page":1,"pageSize":1}' }),
    fetch('/api/Receive/GetReceivesList', { method: 'POST', headers: h, body: '{"page":1,"pageSize":10}' }),
    fetch('/api/Supplier/GetAllSuppliers', { method: 'POST', headers: h }),
  ])
  try { if (r[0].status === 'fulfilled') { const j = JSON.parse(await r[0].value.text()); if (j.success) stats.value.totalOrders = j.data.total || 0 } } catch { }
  try { if (r[1].status === 'fulfilled') { const j = JSON.parse(await r[1].value.text()); if (j.success) stats.value.pendingOrders = j.data.total || 0 } } catch { }
  try { if (r[2].status === 'fulfilled') { const j = JSON.parse(await r[2].value.text()); if (j.success) stats.value.pendingDelivery = j.data.total || 0 } } catch { }
  try { if (r[3].status === 'fulfilled') { const j = JSON.parse(await r[3].value.text()); if (j.code === 200) stats.value.totalDeliveries = j.data.total || 0 } } catch { }
  try { if (r[4].status === 'fulfilled') { const j = JSON.parse(await r[4].value.text()); if (j.code === 200) stats.value.totalReceives = j.data.total || (j.data.items?.length || 0) } } catch { }
  try { if (r[5].status === 'fulfilled') { const j = JSON.parse(await r[5].value.text()); if (j.success) stats.value.suppliers = j.data.length || 0 } } catch { }
}

// ==================== 3D 场景 ====================
let scene, camera, renderer, animId, particles
let camTheta = Math.PI * 0.35, camPhi = 1.2, lastFrameTime = 0
let camDist = 6, dragStartX = 0, mouseNDC = { x: 0, y: 0 }
const DEF_CAMDIST = 6, DEF_THETA = Math.PI * 0.35, DEF_PHI = 1.2
let pivotX = 0, pivotY = 0.5, pivotZ = 0
function resetView() {
  camDist = DEF_CAMDIST; camTheta = DEF_THETA; camPhi = DEF_PHI
  pivotX = 0; pivotY = 0.5; pivotZ = 0
}
const containerData = [], clickables = []
const flowSystems = []

const MAIN_NODES = [
  { x: -5, z: 0, key: 'totalOrders', label: '采购订单', path: '/order/query', color: 0x00e5ff },
  { x: -2.5, z: 0, key: 'pendingOrders', label: '待确认', path: '/order/pending', color: 0xffd740 },
  { x: 0, z: 0, key: 'pendingDelivery', label: '待发货', path: '/order/pending-delivery', color: 0x00e676 },
  { x: 2.5, z: 0, key: 'totalDeliveries', label: '运输中', path: '/delivery/details', color: 0x448aff },
  { x: 5, z: 0, key: 'totalReceives', label: '收货仓', path: '/receive', color: 0xe040fb },
]
const SUPPLIER_NODES = [
  { x: 0, z: -2.5, connectTo: 2, key: 'suppliers', label: '供应商', path: '/supplier', color: 0xff6e40 },
]
const ALL_NODES = [...MAIN_NODES, ...SUPPLIER_NODES]

function createCarModel(color, T) {
  const car = new T.Group()
  const body = new T.Mesh(
    new T.BoxGeometry(0.35, 0.09, 0.55),
    new T.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.5, emissive: color, emissiveIntensity: 0.25 })
  )
  body.position.y = 0.1; car.add(body)
  const cabin = new T.Mesh(
    new T.BoxGeometry(0.2, 0.07, 0.25),
    new T.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.2, emissive: 0x4488aa, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 })
  )
  cabin.position.set(0, 0.18, -0.05); car.add(cabin)
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const wheel = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 8), new T.MeshBasicMaterial({ color: 0x111111 }))
    wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.15, 0.045, sz * 0.2); car.add(wheel)
  }
  const hl = new T.Mesh(new T.SphereGeometry(0.025, 6, 6), new T.MeshBasicMaterial({ color: 0xffff88 }))
  hl.position.set(0.08, 0.11, 0.28); car.add(hl)
  const hl2 = hl.clone(); hl2.position.x = -0.08; car.add(hl2)
  return { group: car, body }
}

async function initThree() {
  const el = document.getElementById('three-panel')
  if (!el) return
  if (!window.THREE) await new Promise(r => { const s = document.createElement('script'); s.src = 'https://unpkg.com/three@0.160.0/build/three.min.js'; s.onload = r; document.head.appendChild(s) })
  const T = window.THREE
  const w = el.clientWidth || 800, h = el.clientHeight || 420

  scene = new T.Scene()
  scene.background = new T.Color(0x050a15)
  scene.fog = new T.FogExp2(0x050a15, 0.0008)
  camera = new T.PerspectiveCamera(40, w / h, 0.3, 30)
  renderer = new T.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  el.appendChild(renderer.domElement)

  el.style.cursor = 'default'
  el.addEventListener('mousedown', onMouseDown)
  el.addEventListener('mousemove', onMouseMove)
  el.addEventListener('mouseup', onMouseUp)
  el.addEventListener('click', onClick)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('contextmenu', e => e.preventDefault())

  // 灯光
  scene.add(new T.AmbientLight(0x112233, 3))
  const d1 = new T.DirectionalLight(0x4488bb, 1.5); d1.position.set(5, 10, 8); scene.add(d1)
  const d2 = new T.DirectionalLight(0x224466, 1); d2.position.set(-3, 3, -5); scene.add(d2)
  ALL_NODES.forEach(def => {
    const pl = new T.PointLight(def.color, 2.5, 8); pl.position.set(def.x, 2, def.z); scene.add(pl)
  })

  // 地面
  const ground = new T.Mesh(
    new T.PlaneGeometry(40, 30),
    new T.MeshStandardMaterial({ color: 0x0a0e1a, roughness: 0.8, metalness: 0.2 })
  )
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; scene.add(ground)
  const gridHelper = new T.GridHelper(40, 40, 0x00ccff, 0x004488)
  gridHelper.position.y = -0.04; gridHelper.material.transparent = true; gridHelper.material.opacity = 0.6
  scene.add(gridHelper)

  // 节点发光底板
  ALL_NODES.forEach(def => {
    for (const [r, op] of [[0.7, 0.7], [0.5, 0.5], [0.32, 0.35]]) {
      const mat = new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: op, depthWrite: false })
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.02, 12, 48), mat)
      ring.rotation.x = -Math.PI / 2; ring.position.set(def.x, 0.01, def.z); scene.add(ring)
    }
    const glowDisc = new T.Mesh(
      new T.CircleGeometry(0.32, 24),
      new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.15, depthWrite: false })
    )
    glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.set(def.x, 0.008, def.z); scene.add(glowDisc)
  })

  // ===== 道路系统 =====
  function buildRoadRibbon(curve, width, y, color, roughness) {
    const pts = curve.getPoints(200)
    const geo = new T.BufferGeometry(); const v = []; const idx = []
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i]; const tg = curve.getTangent(i / (pts.length - 1)).normalize()
      const n = new T.Vector3(-tg.z, 0, tg.x).normalize()
      v.push(pt.x + n.x * width, y, pt.z + n.z * width, pt.x - n.x * width, y, pt.z - n.z * width)
      if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    geo.setAttribute('position', new T.Float32BufferAttribute(v, 3)); geo.setIndex(idx); geo.computeVertexNormals()
    return new T.Mesh(geo, new T.MeshStandardMaterial({ color, roughness, metalness: 0.05 }))
  }

  function createRoad(curve, rw, isMain, T) {
    scene.add(buildRoadRibbon(curve, rw + 0.18, 0.01, 0x0a1520, 0.9))
    const roadMat = new T.MeshStandardMaterial({ color: 0x0d1e30, roughness: 0.3, metalness: 0.6, emissive: 0x003355, emissiveIntensity: 0.4 })
    const roadMesh = buildRoadRibbon(curve, rw, 0.018, 0x0d1e30, 0.5)
    roadMesh.material = roadMat; scene.add(roadMesh)
    const pts = curve.getPoints(isMain ? 300 : 150)
    for (const side of [1, -1]) {
      const eg = new T.BufferGeometry(); const ev = []
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i]; const tg = curve.getTangent(i / (pts.length - 1)).normalize()
        const n = new T.Vector3(-tg.z, 0, tg.x).normalize()
        ev.push(pt.x + n.x * rw * side, 0.022, pt.z + n.z * rw * side)
      }
      eg.setAttribute('position', new T.Float32BufferAttribute(ev, 3))
      scene.add(new T.Line(eg, new T.LineBasicMaterial({ color: 0x00ddff, depthWrite: false })))
    }
    const dg = new T.BufferGeometry(); const dv = []
    for (let i = 0; i < pts.length - 1; i += (isMain ? 8 : 12)) {
      dv.push(pts[i].x, 0.022, pts[i].z, pts[Math.min(i + (isMain ? 4 : 6), pts.length - 1)].x, 0.022, pts[Math.min(i + (isMain ? 4 : 6), pts.length - 1)].z)
    }
    dg.setAttribute('position', new T.Float32BufferAttribute(dv, 3))
    scene.add(new T.LineSegments(dg, new T.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.8, depthWrite: false })))
  }

  function createNodePad(x, z, color, T) {
    const pad = new T.Mesh(new T.CylinderGeometry(0.5, 0.52, 0.03, 32), new T.MeshStandardMaterial({ color: 0x0d1e30, roughness: 0.2, metalness: 0.8, emissive: color, emissiveIntensity: 0.15 }))
    pad.position.set(x, 0.015, z); scene.add(pad)
    for (const [r, op] of [[0.52, 0.6], [0.48, 0.4]]) {
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.015, 12, 48), new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.032, z); scene.add(ring)
    }
  }

  const mainPts = MAIN_NODES.map(d => new T.Vector3(d.x, 0, d.z))
  const mainCurve = new T.CatmullRomCurve3(mainPts, false, 'catmullrom', 0.5)
  createRoad(mainCurve, 0.5, true, T)
  MAIN_NODES.forEach(d => createNodePad(d.x, d.z, d.color, T))

  const branchCurves = []
  SUPPLIER_NODES.forEach(sn => {
    const mn = MAIN_NODES[sn.connectTo]
    const pts = [new T.Vector3(mn.x, 0, mn.z), new T.Vector3(sn.x, 0, sn.z)]
    const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0)
    branchCurves.push(curve)
    createRoad(curve, 0.3, false, T)
    createNodePad(sn.x, sn.z, sn.color, T)
  })

  // 数据晶体
  function createCrystal(x, z, s, T) {
    const g = new T.Group()
    const col = 0x00ccff
    const base = new T.Mesh(new T.BoxGeometry(0.04 * s, 0.06 * s, 0.04 * s), new T.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.3, metalness: 0.8 }))
    base.position.y = 0.03 * s; g.add(base)
    const c1 = new T.Mesh(new T.ConeGeometry(0.06 * s, 0.25 * s, 6), new T.MeshStandardMaterial({ color: col, roughness: 0.1, metalness: 0.3, emissive: col, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }))
    c1.position.y = 0.15 * s; g.add(c1)
    const c2 = new T.Mesh(new T.ConeGeometry(0.04 * s, 0.15 * s, 6), new T.MeshStandardMaterial({ color: 0x00ddff, roughness: 0.1, metalness: 0.3, emissive: 0x00ddff, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 }))
    c2.position.y = 0.3 * s; g.add(c2)
    g.position.set(x, 0, z); scene.add(g)
  }
  [[-5.8, 0.9], [-3.2, -0.8], [-1.5, 0.9], [1.4, 0.9], [3.2, -0.8], [5.8, -0.7],
    [-5.5, -0.8], [-3.8, 0], [1.0, -1.1], [5.5, 0.8],
    [-0.5, -1.8], [1.5, -3.0], [3.0, -1.8], [4.8, -1.5], [0.8, -3.3]]
    .forEach(([tx, tz]) => createCrystal(tx, tz, 0.5 + Math.random() * 0.4, T))

  // 数据塔
  function createDataTower(x, z, bc, lc, s, T) {
    const g = new T.Group(); const ss = s || 1
    const rack = new T.Mesh(new T.BoxGeometry(0.25 * ss, 0.18 * ss, 0.22 * ss), new T.MeshStandardMaterial({ color: 0x0d1e30, roughness: 0.2, metalness: 0.9, emissive: 0x001122, emissiveIntensity: 0.2 }))
    rack.position.y = 0.09 * ss; g.add(rack)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const led = new T.Mesh(new T.BoxGeometry(0.02 * ss, 0.01 * ss, 0.01 * ss), new T.MeshBasicMaterial({ color: lc || 0x00ff88, transparent: true, opacity: 0.4 + Math.random() * 0.6 }))
      led.position.set((-0.06 + j * 0.06) * ss, (0.04 + i * 0.035) * ss, 0.11 * ss); rack.add(led)
    }
    const ant = new T.Mesh(new T.CylinderGeometry(0.005 * ss, 0.008 * ss, 0.1 * ss, 4), new T.MeshStandardMaterial({ color: 0x4488aa, emissive: 0x00ccff, emissiveIntensity: 1, roughness: 0.1, metalness: 0.5 }))
    ant.position.y = 0.22 * ss; g.add(ant)
    g.position.set(x, 0, z); scene.add(g)
  }
  [{ x: -4.2, z: 1.05, bc: 0x0d1e30, lc: 0x00ddff }, { x: -2.5, z: -0.9, bc: 0x0d1e30, lc: 0xaa44ff },
    { x: -1.0, z: 0.95, bc: 0x0d1e30, lc: 0x00ff88 }, { x: 0.6, z: -0.85, bc: 0x0d1e30, lc: 0xff6600 },
    { x: 2.0, z: 0.95, bc: 0x0d1e30, lc: 0x00ffee }, { x: 4.2, z: 1.0, bc: 0x0d1e30, lc: 0xff44aa },
    { x: 5.5, z: -0.85, bc: 0x0d1e30, lc: 0x4488ff }, { x: -6.0, z: -0.7, bc: 0x0d1e30, lc: 0x00ffaa }]
    .forEach(h => createDataTower(h.x, h.z, h.bc, h.lc, 0.8 + Math.random() * 0.3, T))

  // 节点模型
  function buildNode(def, isSupplier) {
    const val = stats.value[def.key] || 0
    const isCar = def.key === 'totalDeliveries'
    const s = isSupplier ? 0.85 : 1.0
    const pH = Math.max(0.6, (0.9 + Math.min(val, 500) * 0.012) * s)
    const bR = 0.55 * s, pR = 0.24 * s
    const grp = new T.Group()

    const baseGeo = new T.CylinderGeometry(bR - 0.03, bR, 0.06 * s, 6)
    const base = new T.Mesh(baseGeo, new T.MeshStandardMaterial({ color: def.color, roughness: 0.25, metalness: 0.5, emissive: def.color, emissiveIntensity: 0.25 }))
    base.position.y = 0.03 * s; grp.add(base)
    const be = new T.LineSegments(new T.EdgesGeometry(baseGeo), new T.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.5, depthWrite: false }))
    be.position.copy(base.position); grp.add(be)

    let pillar, edges, rings = [], beacon = null, beaconGlow = null

    if (isCar) {
      const co = createCarModel(def.color, T)
      co.group.position.y = 0.21; grp.add(co.group)
      pillar = co.body; edges = null
      for (const [ratio, spd] of [[0, 0.8], [0, 0]]) {
        const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.01, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.5, depthWrite: false }))
        ring.position.y = 0.4 + ratio * 0.25; ring.userData = { rotSpeed: spd }; grp.add(ring); rings.push(ring)
      }
      beacon = new T.Mesh(new T.SphereGeometry(0.05, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff }))
      beacon.position.y = 0.55; beacon.userData = { baseScale: 1.0 }; grp.add(beacon)
      beaconGlow = new T.Mesh(new T.SphereGeometry(0.12, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false }))
      beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
    } else {
      const k = def.key
      const mat = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.7, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
      const elm = (c) => new T.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7, depthWrite: false })
      const beam = new T.Mesh(
        new T.CylinderGeometry(0.015, 0.025, pH * 0.7, 8),
        new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending })
      )
      beam.position.y = 0.06 * s + pH * 0.35; grp.add(beam)
      try {
        if (k === 'totalOrders') {
          const w = 0.35 * s, d = 0.3 * s, h1 = pH * 0.4, h2 = pH * 0.35
          pillar = new T.Mesh(new T.BoxGeometry(w, h1, d), mat(def.color)); pillar.position.y = 0.06 * s + h1 / 2; grp.add(pillar)
          const b2 = new T.Mesh(new T.BoxGeometry(w * 0.75, h2, d * 0.8), mat(def.color)); b2.position.y = 0.06 * s + h1 + h2 / 2; grp.add(b2)
          const st = new T.Mesh(new T.CylinderGeometry(0.04 * s, 0.05 * s, 0.2 * s, 8), new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 }))
          st.position.y = 0.06 * s + h1 + h2 + 0.1 * s; grp.add(st)
          edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), elm(def.color)); edges.position.copy(pillar.position); grp.add(edges)
          beacon = new T.Mesh(new T.SphereGeometry(0.05 * s, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 0.06 * s + h1 + h2 + 0.22 * s; beacon.userData = { baseScale: 1 }; grp.add(beacon)
          beaconGlow = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false })); beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
          for (const r of [0.33, 0.66]) { const rg = new T.Mesh(new T.TorusGeometry(w * 0.55, 0.012, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false })); rg.position.y = 0.06 * s + (h1 + h2) * r; rg.userData = { rotSpeed: r === 0.33 ? 0.8 : -0.5 }; grp.add(rg); rings.push(rg) }
        } else if (k === 'pendingOrders') {
          const cr = 0.25 * s, ch = pH * 0.35
          pillar = new T.Mesh(new T.ConeGeometry(cr, ch, 8), mat(def.color)); pillar.position.y = 0.06 * s + ch / 2; pillar.rotation.z = Math.PI; grp.add(pillar)
          const tc = new T.Mesh(new T.ConeGeometry(cr, ch, 8), mat(def.color)); tc.position.y = 0.06 * s + ch * 1.5 + 0.02 * s; grp.add(tc)
          edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), elm(def.color)); edges.position.copy(pillar.position); grp.add(edges)
          beacon = new T.Mesh(new T.SphereGeometry(0.05 * s, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 0.06 * s + ch * 2 + 0.08 * s; beacon.userData = { baseScale: 1 }; grp.add(beacon)
          beaconGlow = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false })); beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
          for (const r of [0.33, 0.66]) { const rg = new T.Mesh(new T.TorusGeometry(cr * 0.8, 0.012, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false })); rg.position.y = 0.06 * s + ch * 2 * r; rg.userData = { rotSpeed: r === 0.33 ? 0.8 : -0.5 }; grp.add(rg); rings.push(rg) }
        } else if (k === 'pendingDelivery') {
          const w = 0.3 * s, h = pH * 0.7, d = 0.35 * s
          pillar = new T.Mesh(new T.BoxGeometry(w, h, d), mat(def.color)); pillar.position.y = 0.06 * s + h / 2; grp.add(pillar)
          edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), elm(def.color)); edges.position.copy(pillar.position); grp.add(edges)
          beacon = new T.Mesh(new T.SphereGeometry(0.05 * s, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 0.06 * s + h + 0.06 * s; beacon.userData = { baseScale: 1 }; grp.add(beacon)
          beaconGlow = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false })); beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
          for (const r of [0.33, 0.66]) { const rg = new T.Mesh(new T.TorusGeometry(w * 0.8, 0.012, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false })); rg.position.y = 0.06 * s + h * r; rg.userData = { rotSpeed: r === 0.33 ? 0.8 : -0.5 }; grp.add(rg); rings.push(rg) }
        } else if (k === 'totalReceives') {
          const w = 0.4 * s, h = pH * 0.5, d = 0.35 * s
          pillar = new T.Mesh(new T.BoxGeometry(w, h, d), mat(def.color)); pillar.position.y = 0.06 * s + h / 2; grp.add(pillar)
          const rh = pH * 0.3, rf = new T.Mesh(new T.ConeGeometry(w * 0.8, rh, 4), mat(def.color))
          rf.position.y = 0.06 * s + h + rh / 2; rf.rotation.y = Math.PI / 4; grp.add(rf)
          edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), elm(def.color)); edges.position.copy(pillar.position); grp.add(edges)
          beacon = new T.Mesh(new T.SphereGeometry(0.05 * s, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 0.06 * s + h + rh + 0.04 * s; beacon.userData = { baseScale: 1 }; grp.add(beacon)
          beaconGlow = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false })); beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
          for (const r of [0.33, 0.66]) { const rg = new T.Mesh(new T.TorusGeometry(w * 0.6, 0.012, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false })); rg.position.y = 0.06 * s + h * r; rg.userData = { rotSpeed: r === 0.33 ? 0.8 : -0.5 }; grp.add(rg); rings.push(rg) }
        } else {
          const w = 0.22 * s, h = pH * 0.8, d = 0.22 * s
          pillar = new T.Mesh(new T.BoxGeometry(w, h, d), mat(def.color)); pillar.position.y = 0.06 * s + h / 2; grp.add(pillar)
          for (let wy = 0; wy < 3; wy++) for (const wx of [-0.06, 0.06]) { const wn = new T.Mesh(new T.BoxGeometry(0.04 * s, 0.05 * s, 0.01 * s), new T.MeshBasicMaterial({ color: 0xaaddff })); wn.position.set(wx * s, 0.06 * s + h * 0.2 + wy * h * 0.25, d / 2 + 0.005); pillar.add(wn) }
          edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), elm(def.color)); edges.position.copy(pillar.position); grp.add(edges)
          const ah = 0.15 * s, an = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, ah, 6), new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.15, metalness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.5 }))
          an.position.y = 0.06 * s + h + ah / 2; grp.add(an)
          beacon = new T.Mesh(new T.SphereGeometry(0.05 * s, 8, 8), new T.MeshBasicMaterial({ color: 0xffffff })); beacon.position.y = 0.06 * s + h + ah + 0.04 * s; beacon.userData = { baseScale: 1 }; grp.add(beacon)
          beaconGlow = new T.Mesh(new T.SphereGeometry(0.12 * s, 8, 8), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, depthWrite: false })); beaconGlow.position.copy(beacon.position); grp.add(beaconGlow)
          for (const r of [0.33, 0.66]) { const rg = new T.Mesh(new T.TorusGeometry(w * 0.9, 0.012, 8, 32), new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.8, depthWrite: false })); rg.position.y = 0.06 * s + h * r; rg.userData = { rotSpeed: r === 0.33 ? 0.8 : -0.5 }; grp.add(rg); rings.push(rg) }
        }
      } catch (e) { console.error('buildNode error:', def.key, e); pillar = new T.Mesh(new T.CylinderGeometry(pR * 0.7, pR, pH, 8), new T.MeshStandardMaterial({ color: def.color, roughness: 0.15, metalness: 0.7, emissive: def.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })); pillar.position.y = 0.06 * s + pH / 2; grp.add(pillar) }
    }

    grp.position.set(def.x, 0, def.z); scene.add(grp)
    containerData.push({ pillar, edges, rings, beacon, beaconGlow, label: def.label, path: def.path, color: def.color, key: def.key })
    clickables.push(pillar)
  }
  MAIN_NODES.forEach(d => buildNode(d, false))
  SUPPLIER_NODES.forEach(d => buildNode(d, true))

  // 流动粒子
  function addFlowParticles(curve, color, count, size, T) {
    const geo = new T.BufferGeometry(); const pos = new Float32Array(count * 3); const data = []
    for (let i = 0; i < count; i++) {
      const td = { t: Math.random(), speed: 0.04 + Math.random() * 0.08 }; data.push(td)
      const pt = curve.getPoint(td.t); pos[i * 3] = pt.x; pos[i * 3 + 1] = pt.y + 0.06; pos[i * 3 + 2] = pt.z
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3))
    const pts = new T.Points(geo, new T.PointsMaterial({ color, size, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }))
    scene.add(pts); flowSystems.push({ curve, points: pts, data })
  }
  addFlowParticles(mainCurve, 0x00ddff, 80, 0.10, T)
  branchCurves.forEach((c, i) => addFlowParticles(c, SUPPLIER_NODES[i].color, 20, 0.08, T))

  // 行驶小车
  const carColors = [0xff3366, 0x00ffcc, 0xffaa00, 0xcc44ff, 0x00ddff]
  const roadCars = [], laneOff = 0.13
  for (let i = 0; i < 5; i++) {
    const co = createCarModel(carColors[i], T)
    const mc = co.group; mc.scale.set(0.55, 0.55, 0.55)
    co.body.material.emissiveIntensity = 0.8
    co.body.material.emissive = new THREE.Color(carColors[i])
    const dir = i < 3 ? 1 : -1, lane = dir > 0 ? 1 : -1
    const td = { t: Math.random(), speed: 0.025 + Math.random() * 0.04, dir, lane }
    const pt = mainCurve.getPoint(td.t)
    const tg = mainCurve.getTangent(td.t).normalize()
    const sn = new T.Vector3(-tg.z, 0, tg.x).normalize()
    mc.position.copy(pt).addScaledVector(sn, laneOff * lane)
    mc.position.y += 0.05
    mc.rotation.y = Math.atan2(tg.x, tg.z) * (dir > 0 ? 1 : -1)
    scene.add(mc); roadCars.push({ car: mc, data: td })
  }
  flowSystems.push({ curve: mainCurve, roadCars, laneOff })

  // 环境粒子
  const pc = 400; const pg = new T.BufferGeometry(); const pp = new Float32Array(pc * 3); const pc2 = new Float32Array(pc)
  for (let i = 0; i < pc; i++) {
    const rad = 3 + Math.random() * 12, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
    pp[i * 3] = Math.cos(th) * Math.sin(ph) * rad; pp[i * 3 + 1] = Math.sin(th) * Math.sin(ph) * rad * 0.4 + 4; pp[i * 3 + 2] = Math.cos(ph) * rad
    pc2[i] = 0.3 + Math.random() * 0.7
  }
  pg.setAttribute('position', new T.BufferAttribute(pp, 3))
  pg.setAttribute('size', new T.Float32BufferAttribute(pc2, 1))
  particles = new T.Points(pg, new T.PointsMaterial({ color: 0x88ccff, size: 0.06, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }))
  scene.add(particles)

  animate()
}

function animate() {
  animId = requestAnimationFrame(animate)
  const now = performance.now() * 0.001, t = now
  const dt = lastFrameTime ? Math.min(now - lastFrameTime, 0.1) : 1 / 60; lastFrameTime = now

  camera.position.x = camDist * Math.sin(camPhi) * Math.cos(camTheta) + pivotX
  camera.position.y = camDist * Math.cos(camPhi) + pivotY
  camera.position.z = camDist * Math.sin(camPhi) * Math.sin(camTheta) + pivotZ
  camera.lookAt(pivotX, pivotY, pivotZ)

  if (particles) particles.rotation.y += 0.0004

  flowSystems.forEach(sys => {
    if (sys.points && sys.data) {
      const arr = sys.points.geometry.attributes.position.array
      for (let i = 0; i < sys.data.length; i++) {
        sys.data[i].t += sys.data[i].speed * dt; if (sys.data[i].t > 1) sys.data[i].t -= 1
        const pt = sys.curve.getPoint(sys.data[i].t)
        arr[i * 3] = pt.x; arr[i * 3 + 1] = pt.y + 0.06; arr[i * 3 + 2] = pt.z
      }
      sys.points.geometry.attributes.position.needsUpdate = true
    }
    if (sys.roadCars) {
      sys.roadCars.forEach(rc => {
        rc.data.t += rc.data.speed * dt * rc.data.dir
        if (rc.data.t > 1) rc.data.t -= 1; if (rc.data.t < 0) rc.data.t += 1
        const pt = sys.curve.getPoint(rc.data.t)
        const tg = sys.curve.getTangent(rc.data.t).normalize()
        const sn = new THREE.Vector3(-tg.z, 0, tg.x).normalize()
        rc.car.position.copy(pt).addScaledVector(sn, (sys.laneOff || 0.13) * rc.data.lane)
        rc.car.position.y += 0.06
        rc.car.rotation.y = Math.atan2(tg.x, tg.z) * (rc.data.dir > 0 ? 1 : -1)
      })
    }
  })

  containerData.forEach((cd, i) => {
    if (cd.rings) cd.rings.forEach(r => { r.rotation.z += r.userData.rotSpeed * dt * 2 })
    if (cd.beacon) {
      const pulse = 1 + Math.sin(t * 3.5 + i * 0.8) * 0.22
      cd.beacon.scale.setScalar(pulse)
      if (cd.beaconGlow) { cd.beaconGlow.scale.setScalar(pulse * 1.1); cd.beaconGlow.material.opacity = 0.15 + Math.sin(t * 3.5 + i * 0.8) * 0.1 }
    }
    if (cd.edges) cd.edges.material.opacity = 0.25 + Math.sin(t * 1.5 + i) * 0.12
  })

  renderer?.render(scene, camera)
}

function onMouseDown(e) { dragStartX = e.clientX }
function onMouseUp() { }
function onWheel(e) {
  e.preventDefault()
  camDist += e.deltaY * 0.015; camDist = Math.max(2.0, Math.min(DEF_CAMDIST, camDist))
}
function onMouseMove(e) {
  if (!camera) return; const el = document.getElementById('three-panel'); if (!el) return
  if (e.buttons & 1) {
    const dx = e.clientX - dragStartX
    if (Math.abs(dx) > 2) {
      camTheta += dx * 0.006
      camTheta = Math.max(DEF_THETA - 1.0, Math.min(DEF_THETA + 1.0, camTheta))
      dragStartX = e.clientX
      el.style.cursor = 'ew-resize'
    }
    return
  }
  const rect = el.getBoundingClientRect()
  const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1, my = -((e.clientY - rect.top) / rect.height) * 2 + 1
  mouseNDC = { x: mx, y: my }
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(mx, my), camera)
  const hits = rc.intersectObjects(clickables)
  if (hits.length > 0) {
    const cd = containerData.find(c => c.pillar === hits[0].object)
    if (cd) {
      el.style.cursor = 'pointer'
      tooltip3D.value = { show: true, x: e.clientX, y: e.clientY, label: cd.label, value: stats.value[cd.key] || 0, path: cd.path }
      if (cd.edges) cd.edges.material.opacity = 0.9
      cd.pillar.material.emissive = new THREE.Color(cd.color)
      cd.pillar.material.emissiveIntensity = 0.5; return
    }
  }
  el.style.cursor = 'default'; tooltip3D.value.show = false
  containerData.forEach(cd => { cd.pillar.material.emissiveIntensity = 0.3 })
}
function onClick(e) {
  if (!camera) return
  const el = document.getElementById('three-panel'); if (!el) return
  const rect = el.getBoundingClientRect()
  const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1, my = -((e.clientY - rect.top) / rect.height) * 2 + 1
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(mx, my), camera)
  const hits = rc.intersectObjects(clickables)
  if (hits.length > 0) { const cd = containerData.find(c => c.pillar === hits[0].object); if (cd) router.push(cd.path) }
}
function onResize() {
  if (renderer) { const el = document.getElementById('three-panel'); if (el) { const w = el.clientWidth || 800, h = el.clientHeight || 420; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h) } }
}

onMounted(() => { fetchStats(); setTimeout(initThree, 300); addEventListener('resize', onResize) })
onBeforeUnmount(() => {
  removeEventListener('resize', onResize); if (animId) cancelAnimationFrame(animId)
  const el = document.getElementById('three-panel')
  if (el) {
    el.removeEventListener('mousedown', onMouseDown); el.removeEventListener('mousemove', onMouseMove)
    el.removeEventListener('mouseup', onMouseUp); el.removeEventListener('click', onClick); el.removeEventListener('wheel', onWheel)
  }
  if (renderer) { renderer.dispose(); renderer.domElement.remove() }
})
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>数字孪生</h3><Logout /></div>
      <div class="content">
        <div class="panel-3d">
          <div class="panel-3d-head">
            <span class="panel-3d-title">供应链数字孪生</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="panel-3d-hint">水平拖拽旋转 · 滚轮缩放 · 点击跳转</span>
              <button class="reset-btn" @click="resetView" title="重置视角">↺</button>
            </div>
          </div>
          <div id="three-panel"></div>
          <Teleport to="body">
            <div v-if="tooltip3D.show" class="three-tip" :style="{left:tooltip3D.x+'px',top:(tooltip3D.y-60)+'px'}">
              <div class="tt-label">{{ tooltip3D.label }}</div>
              <div class="tt-val">{{ tooltip3D.value }}</div>
              <div class="tt-click">点击查看详情 →</div>
            </div>
          </Teleport>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.three-tip{position:fixed;z-index:9999;pointer-events:none;background:rgba(5,10,21,.96);color:#88ccff;padding:10px 16px;border-radius:6px;border:1px solid rgba(0,200,255,.4);font-size:12px;white-space:nowrap;box-shadow:0 0 20px rgba(0,200,255,.15),0 4px 20px rgba(0,0,0,.5);}
.three-tip .tt-label{color:#4488bb;font-size:10px;letter-spacing:2px;text-transform:uppercase;}
.three-tip .tt-val{font-size:22px;font-weight:700;color:#00ddff;text-shadow:0 0 10px rgba(0,220,255,.5);}
.three-tip .tt-click{color:#336688;font-size:10px;margin-top:2px;}
</style>

<style scoped>
.layout{display:flex;min-height:100vh}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.header{height:60px;background:#fff;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee}
.content{padding:20px;flex:1;overflow-y:auto;background:#f0f4f8}
.panel-3d{background:#050a15;border-radius:8px;overflow:hidden;border:1px solid #0d2a4a;box-shadow:0 0 30px rgba(0,100,200,.1),0 2px 16px rgba(0,0,0,.5);user-select:none;-webkit-user-select:none}
.panel-3d-head{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:1px solid #0d2a4a;background:#080e1a;user-select:none;-webkit-user-select:none}
.panel-3d-title{font-size:16px;font-weight:600;color:#00ddff;letter-spacing:2px;text-shadow:0 0 10px rgba(0,220,255,.3)}
.panel-3d-hint{font-size:11px;color:#4488bb;letter-spacing:1px}
#three-panel{width:100%;height:calc(100vh - 200px);user-select:none;-webkit-user-select:none}
.reset-btn{width:28px;height:28px;border-radius:50%;border:1px solid #0d3a5a;background:#081420;color:#4488bb;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;transition:all .2s;line-height:1}
.reset-btn:hover{background:#0d2a4a;color:#00ddff;border-color:#00aaff;box-shadow:0 0 10px rgba(0,170,255,.3)}
</style>
