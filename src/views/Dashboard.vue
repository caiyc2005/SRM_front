<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

const router = useRouter()
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
const userName = userInfo.userName || 'admin'
const currentTime = ref('')
let clockTimer = null

const stats = ref({ totalOrders:0, pendingOrders:0, pendingDelivery:0, totalDeliveries:0, totalReceives:0, suppliers:0 })

async function fetchStats() {
  const t = localStorage.getItem('token')
  const h = { 'Content-Type':'application/json', ...(t?{'Authorization':`Bearer ${t}`}:{}) }
  const r = await Promise.allSettled([
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"status":0,"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Orders/GetOrdersByList', {method:'POST',headers:h,body:'{"status":2,"pageIndex":1,"pageSize":1}'}),
    fetch('/api/Delivery/GetDeliveryNote', {method:'POST',headers:h,body:'{"page":1,"pageSize":1}'}),
    fetch('/api/Receive/GetReceivesList', {method:'POST',headers:h,body:'{"page":1,"pageSize":10}'}),
    fetch('/api/Supplier/GetAllSuppliers', {method:'POST',headers:h}),
  ])
  try{if(r[0].status==='fulfilled'){const j=JSON.parse(await r[0].value.text());if(j.success)stats.value.totalOrders=j.data.total||0}}catch{}
  try{if(r[1].status==='fulfilled'){const j=JSON.parse(await r[1].value.text());if(j.success)stats.value.pendingOrders=j.data.total||0}}catch{}
  try{if(r[2].status==='fulfilled'){const j=JSON.parse(await r[2].value.text());if(j.success)stats.value.pendingDelivery=j.data.total||0}}catch{}
  try{if(r[3].status==='fulfilled'){const j=JSON.parse(await r[3].value.text());if(j.code===200)stats.value.totalDeliveries=j.data.total||0}}catch{}
  try{if(r[4].status==='fulfilled'){const j=JSON.parse(await r[4].value.text());if(j.code===200)stats.value.totalReceives=j.data.total||(j.data.items?.length||0)}}catch{}
  try{if(r[5].status==='fulfilled'){const j=JSON.parse(await r[5].value.text());if(j.success)stats.value.suppliers=j.data.length||0}}catch{}
}

const completionRate = computed(()=>stats.value.totalOrders?Math.round((stats.value.totalOrders-stats.value.pendingOrders)/stats.value.totalOrders*100):0)
const deliveryRate = computed(()=>stats.value.totalOrders?Math.round(stats.value.totalDeliveries/stats.value.totalOrders*100):0)
const receiveRate = computed(()=>stats.value.totalDeliveries?Math.min(Math.round(stats.value.totalReceives/stats.value.totalDeliveries*100),100):0)

function tick(){
  const n=new Date();const w=['日','一','二','三','四','五','六']
  currentTime.value=`${n.getFullYear()}年${String(n.getMonth()+1).padStart(2,'0')}月${String(n.getDate()).padStart(2,'0')}日 星期${w[n.getDay()]} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`
}

// ==================== 3D 场景 ====================
let scene, camera, renderer, animId, particles
let camTheta=Math.PI*0.35, camPhi=1.15, lastFrameTime=0
let isDragging=false, dragMoved=false, dragPrevX=0, dragPrevY=0
let camDist=6, mouseNDC={x:0,y:0}
const DEF_CAMDIST=6, DEF_THETA=Math.PI*0.35, DEF_PHI=1.2
let pivotX=0, pivotY=0.5, pivotZ=0
function resetView(){
  camDist=DEF_CAMDIST;camTheta=DEF_THETA;camPhi=DEF_PHI
  pivotX=0;pivotY=0.5;pivotZ=0
}
const containerData=[], clickables=[]
const flowSystems=[]

const MAIN_NODES=[
  {x:-5,z:0,key:'totalOrders',label:'采购订单',path:'/order/query',color:0x00e5ff},
  {x:-2.5,z:0,key:'pendingOrders',label:'待确认',path:'/order/pending',color:0xffd740},
  {x:0,z:0,key:'pendingDelivery',label:'待发货',path:'/order/pending-delivery',color:0x00e676},
  {x:2.5,z:0,key:'totalDeliveries',label:'运输中',path:'/delivery/details',color:0x448aff},
  {x:5,z:0,key:'totalReceives',label:'收货仓',path:'/receive',color:0xe040fb},
]
const SUPPLIER_NODES=[
  {x:0,z:-2.5,connectTo:2,key:'suppliers',label:'供应商',path:'/supplier',color:0xff6e40},
]
const ALL_NODES=[...MAIN_NODES,...SUPPLIER_NODES]

const tooltip3D=ref({show:false,x:0,y:0,label:'',value:'',sub:''})

function createCarModel(color,T){
  const car=new T.Group()
  const body=new T.Mesh(
    new T.BoxGeometry(0.35,0.09,0.55),
    new T.MeshStandardMaterial({color,roughness:0.2,metalness:0.5,emissive:color,emissiveIntensity:0.25})
  )
  body.position.y=0.1;car.add(body)
  const cabin=new T.Mesh(
    new T.BoxGeometry(0.2,0.07,0.25),
    new T.MeshStandardMaterial({color:0x88ccff,roughness:0.1,metalness:0.2,emissive:0x4488aa,emissiveIntensity:0.3,transparent:true,opacity:0.7})
  )
  cabin.position.set(0,0.18,-0.05);car.add(cabin)
  for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
    const wheel=new T.Mesh(new T.CylinderGeometry(0.045,0.045,0.03,8),new T.MeshBasicMaterial({color:0x111111}))
    wheel.rotation.z=Math.PI/2;wheel.position.set(sx*0.15,0.045,sz*0.2);car.add(wheel)
  }
  const hl=new T.Mesh(new T.SphereGeometry(0.025,6,6),new T.MeshBasicMaterial({color:0xffff88}))
  hl.position.set(0.08,0.11,0.28);car.add(hl)
  const hl2=hl.clone();hl2.position.x=-0.08;car.add(hl2)
  return {group:car, body}
}

async function initThree(){
  const el=document.getElementById('three-panel')
  if(!el)return
  if(!window.THREE)await new Promise(r=>{const s=document.createElement('script');s.src='https://unpkg.com/three@0.160.0/build/three.min.js';s.onload=r;document.head.appendChild(s)})
  const T=window.THREE
  const w=el.clientWidth||800, h=el.clientHeight||420

  // 场景
  scene=new T.Scene()
  scene.background=new T.Color(0x1e3048)
  scene.fog=new T.FogExp2(0x1e3048,0.0001)
  camera=new T.PerspectiveCamera(40,w/h,0.3,30)
  renderer=new T.WebGLRenderer({antialias:true})
  renderer.setSize(w,h)
  renderer.setPixelRatio(Math.min(devicePixelRatio,2))
  el.appendChild(renderer.domElement)

  el.style.cursor='grab'
  el.addEventListener('mousedown',onMouseDown)
  el.addEventListener('mousemove',onMouseMove)
  el.addEventListener('mouseup',onMouseUp)
  el.addEventListener('click',onClick)
  el.addEventListener('wheel',onWheel,{passive:false})
  el.addEventListener('contextmenu',e=>e.preventDefault())

  // 灯光
  scene.add(new T.AmbientLight(0x556688,4))
  const d1=new T.DirectionalLight(0x8899cc,3);d1.position.set(5,10,8);scene.add(d1)
  const d2=new T.DirectionalLight(0x667799,2);d2.position.set(-3,3,-5);scene.add(d2)
  ALL_NODES.forEach(def=>{
    const pl=new T.PointLight(def.color,1.2,6);pl.position.set(def.x,1.5,def.z);scene.add(pl)
  })

  // 地面（大面积覆盖）
  const ground=new T.Mesh(
    new T.PlaneGeometry(40,30),
    new T.MeshStandardMaterial({color:0x384438,roughness:0.9,metalness:0.05})
  )
  ground.rotation.x=-Math.PI/2;ground.position.y=-0.06;scene.add(ground)

  // 节点发光底板
  ALL_NODES.forEach(def=>{
    for(const[r,op]of[[0.7,0.6],[0.5,0.4],[0.32,0.25]]){
      const ring=new T.Mesh(new T.TorusGeometry(r,0.015,8,48),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:op,depthWrite:false}))
      ring.rotation.x=-Math.PI/2;ring.position.set(def.x,0.01,def.z);scene.add(ring)
    }
  })

  // ===== 道路系统 =====
  function buildRoadRibbon(curve,width,y,color,roughness){
    const pts=curve.getPoints(200)
    const geo=new T.BufferGeometry();const v=[];const idx=[]
    for(let i=0;i<pts.length;i++){
      const pt=pts[i];const tg=curve.getTangent(i/(pts.length-1)).normalize()
      const n=new T.Vector3(-tg.z,0,tg.x).normalize()
      v.push(pt.x+n.x*width,y,pt.z+n.z*width, pt.x-n.x*width,y,pt.z-n.z*width)
      if(i<pts.length-1){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
    }
    geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(idx);geo.computeVertexNormals()
    return new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness,metalness:0.05}))
  }

  function createRoad(curve,rw,isMain,T){
    // 路肩 + 路面
    scene.add(buildRoadRibbon(curve,rw+0.18,0.01,0x909898,0.85))
    scene.add(buildRoadRibbon(curve,rw,0.018,0x586068,0.5))
    const pts=curve.getPoints(isMain?300:150)
    // 白色边线
    for(const side of[1,-1]){
      const eg=new T.BufferGeometry();const ev=[]
      for(let i=0;i<pts.length;i++){
        const pt=pts[i];const tg=curve.getTangent(i/(pts.length-1)).normalize()
        const n=new T.Vector3(-tg.z,0,tg.x).normalize()
        ev.push(pt.x+n.x*rw*side,0.022,pt.z+n.z*rw*side)
      }
      eg.setAttribute('position',new T.Float32BufferAttribute(ev,3))
      scene.add(new T.Line(eg,new T.LineBasicMaterial({color:0xffffff,depthWrite:false})))
    }
    // 黄色虚线
    const dg=new T.BufferGeometry();const dv=[]
    for(let i=0;i<pts.length-1;i+=(isMain?8:12)){
      dv.push(pts[i].x,0.022,pts[i].z,pts[Math.min(i+(isMain?4:6),pts.length-1)].x,0.022,pts[Math.min(i+(isMain?4:6),pts.length-1)].z)
    }
    dg.setAttribute('position',new T.Float32BufferAttribute(dv,3))
    scene.add(new T.LineSegments(dg,new T.LineBasicMaterial({color:0xffc800,transparent:true,opacity:0.65,depthWrite:false})))
  }

  function createNodePad(x,z,color,T){
    const pad=new T.Mesh(new T.CylinderGeometry(0.5,0.52,0.03,24),new T.MeshStandardMaterial({color:0x586068,roughness:0.5,metalness:0.1}))
    pad.position.set(x,0.015,z);scene.add(pad)
    const ring=new T.Mesh(new T.TorusGeometry(0.5,0.025,8,24),new T.MeshBasicMaterial({color,transparent:true,opacity:0.5,depthWrite:false}))
    ring.rotation.x=-Math.PI/2;ring.position.set(x,0.032,z);scene.add(ring)
  }

  // 主路线
  const mainPts=MAIN_NODES.map(d=>new T.Vector3(d.x,0,d.z))
  const mainCurve=new T.CatmullRomCurve3(mainPts,false,'catmullrom',0.5)
  createRoad(mainCurve,0.5,true,T)
  MAIN_NODES.forEach(d=>createNodePad(d.x,d.z,d.color,T))

  // 供应商支路
  const branchCurves=[]
  SUPPLIER_NODES.forEach(sn=>{
    const mn=MAIN_NODES[sn.connectTo]
    const pts=[new T.Vector3(mn.x,0,mn.z),new T.Vector3(sn.x,0,sn.z)]
    const curve=new T.CatmullRomCurve3(pts,false,'catmullrom',0)
    branchCurves.push(curve)
    createRoad(curve,0.3,false,T)
    createNodePad(sn.x,sn.z,sn.color,T)
  })

  // ===== 景观：小树 =====
  function createTree(x,z,s,T){
    const tree=new T.Group()
    const trunk=new T.Mesh(new T.CylinderGeometry(0.04*s,0.06*s,0.25*s,6),new T.MeshStandardMaterial({color:0x8B6914,roughness:0.9}))
    trunk.position.y=0.12*s;tree.add(trunk)
    const l1=new T.Mesh(new T.ConeGeometry(0.15*s,0.3*s,8),new T.MeshStandardMaterial({color:0x4a8c3f,roughness:0.8}))
    l1.position.y=0.28*s;tree.add(l1)
    const l2=new T.Mesh(new T.ConeGeometry(0.11*s,0.22*s,8),new T.MeshStandardMaterial({color:0x5da04e,roughness:0.8}))
    l2.position.y=0.42*s;tree.add(l2)
    tree.position.set(x,0,z);scene.add(tree)
  }
  [[-5.8,0.9],[-3.2,-0.8],[-1.5,0.9],[1.4,0.9],[3.2,-0.8],[5.8,-0.7],
   [-5.5,-0.8],[-3.8,0],[1.0,-1.1],[5.5,0.8],
   [-0.5,-1.8],[1.5,-3.0],[3.0,-1.8],[4.8,-1.5],[0.8,-3.3]]
  .forEach(([tx,tz])=>createTree(tx,tz,0.5+Math.random()*0.4,T))

  // ===== 景观：小房子 =====
  function createHouse(x,z,bc,rc,s,T){
    const h=new T.Group();const ss=s||1
    h.add(new T.Mesh(new T.BoxGeometry(0.35*ss,0.22*ss,0.3*ss),new T.MeshStandardMaterial({color:bc,roughness:0.6}))).position.y=0.11*ss
    const roof=new T.Mesh(new T.ConeGeometry(0.28*ss,0.18*ss,4),new T.MeshStandardMaterial({color:rc,roughness:0.5}))
    roof.position.y=0.31*ss;roof.rotation.y=Math.PI/4;h.add(roof)
    const door=new T.Mesh(new T.BoxGeometry(0.08*ss,0.1*ss,0.02*ss),new T.MeshStandardMaterial({color:0x8B6914,roughness:0.7}))
    door.position.set(0,0.07*ss,0.15*ss);h.add(door)
    for(const wx of[-0.09,0.09]){
      const win=new T.Mesh(new T.BoxGeometry(0.06*ss,0.06*ss,0.01*ss),new T.MeshBasicMaterial({color:0xaaddff}))
      win.position.set(wx*ss,0.15*ss,0.15*ss);h.add(win)
    }
    h.position.set(x,0,z);scene.add(h)
  }
  [{x:-4.2,z:1.05,bc:0xf5e6d3,rc:0xc0392b},{x:-2.5,z:-0.9,bc:0xe8dcc8,rc:0x8e44ad},
   {x:-1.0,z:0.95,bc:0xfdebd0,rc:0x2980b9},{x:0.6,z:-0.85,bc:0xf5e6d3,rc:0xd35400},
   {x:2.0,z:0.95,bc:0xe8dcc8,rc:0x27ae60},{x:4.2,z:1.0,bc:0xfdebd0,rc:0xc0392b},
   {x:5.5,z:-0.85,bc:0xf5e6d3,rc:0x8e44ad},{x:-6.0,z:-0.7,bc:0xe8dcc8,rc:0x2980b9}]
  .forEach(h=>createHouse(h.x,h.z,h.bc,h.rc,0.8+Math.random()*0.3,T))

  // ===== 节点模型 =====
  function buildNode(def,isSupplier){
    const val=stats.value[def.key]||0
    const isCar=def.key==='totalDeliveries'
    const s=isSupplier?0.85:1.0
    const pH=Math.max(0.6,(0.9+Math.min(val,500)*0.012)*s)
    const bR=0.55*s, pR=0.24*s
    const grp=new T.Group()

    // 底座
    const baseGeo=new T.CylinderGeometry(bR-0.03,bR,0.06*s,6)
    const base=new T.Mesh(baseGeo,new T.MeshStandardMaterial({color:def.color,roughness:0.25,metalness:0.5,emissive:def.color,emissiveIntensity:0.25}))
    base.position.y=0.03*s;grp.add(base)
    const be=new T.LineSegments(new T.EdgesGeometry(baseGeo),new T.LineBasicMaterial({color:def.color,transparent:true,opacity:0.5,depthWrite:false}))
    be.position.copy(base.position);grp.add(be)

    let pillar,edges,rings=[],beacon=null,beaconGlow=null

    if(isCar){
      // 运输中用小车
      const co=createCarModel(def.color,T)
      co.group.position.y=0.21;grp.add(co.group)
      pillar=co.body;edges=null
      for(const[ratio,spd]of[[0,0.8],[0,0]]){
        const ring=new T.Mesh(new T.TorusGeometry(0.22,0.01,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.5,depthWrite:false}))
        ring.position.y=0.4+ratio*0.25;ring.userData={rotSpeed:spd};grp.add(ring);rings.push(ring)
      }
      beacon=new T.Mesh(new T.SphereGeometry(0.05,8,8),new T.MeshBasicMaterial({color:0xffffff}))
      beacon.position.y=0.55;beacon.userData={baseScale:1.0};grp.add(beacon)
      beaconGlow=new T.Mesh(new T.SphereGeometry(0.12,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}))
      beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
    }else{
      // 根据类型构建不同形状
      const k=def.key
      const mat=(c)=>new T.MeshStandardMaterial({color:c,roughness:0.25,metalness:0.5,emissive:c,emissiveIntensity:0.3,transparent:true,opacity:0.85})
      const elm=(c)=>new T.LineBasicMaterial({color:c,transparent:true,opacity:0.4,depthWrite:false})
      try{
      if(k==='totalOrders'){
        const w=0.35*s,d=0.3*s,h1=pH*0.4,h2=pH*0.35
        pillar=new T.Mesh(new T.BoxGeometry(w,h1,d),mat(def.color));pillar.position.y=0.06*s+h1/2;grp.add(pillar)
        const b2=new T.Mesh(new T.BoxGeometry(w*0.75,h2,d*0.8),mat(def.color));b2.position.y=0.06*s+h1+h2/2;grp.add(b2)
        const st=new T.Mesh(new T.CylinderGeometry(0.04*s,0.05*s,0.2*s,8),new T.MeshStandardMaterial({color:0x888888,roughness:0.3,metalness:0.8}))
        st.position.y=0.06*s+h1+h2+0.1*s;grp.add(st)
        edges=new T.LineSegments(new T.EdgesGeometry(pillar.geometry),elm(def.color));edges.position.copy(pillar.position);grp.add(edges)
        beacon=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshBasicMaterial({color:0xffffff}));beacon.position.y=0.06*s+h1+h2+0.22*s;beacon.userData={baseScale:1};grp.add(beacon)
        beaconGlow=new T.Mesh(new T.SphereGeometry(0.12*s,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}));beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
        for(const r of[0.33,0.66]){const rg=new T.Mesh(new T.TorusGeometry(w*0.55,0.012,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.55,depthWrite:false}));rg.position.y=0.06*s+(h1+h2)*r;rg.userData={rotSpeed:r===0.33?0.8:-0.5};grp.add(rg);rings.push(rg)}
      }else if(k==='pendingOrders'){
        const cr=0.25*s,ch=pH*0.35
        pillar=new T.Mesh(new T.ConeGeometry(cr,ch,8),mat(def.color));pillar.position.y=0.06*s+ch/2;pillar.rotation.z=Math.PI;grp.add(pillar)
        const tc=new T.Mesh(new T.ConeGeometry(cr,ch,8),mat(def.color));tc.position.y=0.06*s+ch*1.5+0.02*s;grp.add(tc)
        edges=new T.LineSegments(new T.EdgesGeometry(pillar.geometry),elm(def.color));edges.position.copy(pillar.position);grp.add(edges)
        beacon=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshBasicMaterial({color:0xffffff}));beacon.position.y=0.06*s+ch*2+0.08*s;beacon.userData={baseScale:1};grp.add(beacon)
        beaconGlow=new T.Mesh(new T.SphereGeometry(0.12*s,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}));beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
        for(const r of[0.33,0.66]){const rg=new T.Mesh(new T.TorusGeometry(cr*0.8,0.012,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.55,depthWrite:false}));rg.position.y=0.06*s+ch*2*r;rg.userData={rotSpeed:r===0.33?0.8:-0.5};grp.add(rg);rings.push(rg)}
      }else if(k==='pendingDelivery'){
        const w=0.3*s,h=pH*0.7,d=0.35*s
        pillar=new T.Mesh(new T.BoxGeometry(w,h,d),mat(def.color));pillar.position.y=0.06*s+h/2;grp.add(pillar)
        edges=new T.LineSegments(new T.EdgesGeometry(pillar.geometry),elm(def.color));edges.position.copy(pillar.position);grp.add(edges)
        beacon=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshBasicMaterial({color:0xffffff}));beacon.position.y=0.06*s+h+0.06*s;beacon.userData={baseScale:1};grp.add(beacon)
        beaconGlow=new T.Mesh(new T.SphereGeometry(0.12*s,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}));beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
        for(const r of[0.33,0.66]){const rg=new T.Mesh(new T.TorusGeometry(w*0.8,0.012,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.55,depthWrite:false}));rg.position.y=0.06*s+h*r;rg.userData={rotSpeed:r===0.33?0.8:-0.5};grp.add(rg);rings.push(rg)}
      }else if(k==='totalReceives'){
        const w=0.4*s,h=pH*0.5,d=0.35*s
        pillar=new T.Mesh(new T.BoxGeometry(w,h,d),mat(def.color));pillar.position.y=0.06*s+h/2;grp.add(pillar)
        const rh=pH*0.3,rf=new T.Mesh(new T.ConeGeometry(w*0.8,rh,4),mat(def.color))
        rf.position.y=0.06*s+h+rh/2;rf.rotation.y=Math.PI/4;grp.add(rf)
        edges=new T.LineSegments(new T.EdgesGeometry(pillar.geometry),elm(def.color));edges.position.copy(pillar.position);grp.add(edges)
        beacon=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshBasicMaterial({color:0xffffff}));beacon.position.y=0.06*s+h+rh+0.04*s;beacon.userData={baseScale:1};grp.add(beacon)
        beaconGlow=new T.Mesh(new T.SphereGeometry(0.12*s,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}));beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
        for(const r of[0.33,0.66]){const rg=new T.Mesh(new T.TorusGeometry(w*0.6,0.012,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.55,depthWrite:false}));rg.position.y=0.06*s+h*r;rg.userData={rotSpeed:r===0.33?0.8:-0.5};grp.add(rg);rings.push(rg)}
      }else{
        const w=0.22*s,h=pH*0.8,d=0.22*s
        pillar=new T.Mesh(new T.BoxGeometry(w,h,d),mat(def.color));pillar.position.y=0.06*s+h/2;grp.add(pillar)
        for(let wy=0;wy<3;wy++)for(const wx of[-0.06,0.06]){const wn=new T.Mesh(new T.BoxGeometry(0.04*s,0.05*s,0.01*s),new T.MeshBasicMaterial({color:0xaaddff}));wn.position.set(wx*s,0.06*s+h*0.2+wy*h*0.25,d/2+0.005);pillar.add(wn)}
        edges=new T.LineSegments(new T.EdgesGeometry(pillar.geometry),elm(def.color));edges.position.copy(pillar.position);grp.add(edges)
        const ah=0.15*s,an=new T.Mesh(new T.CylinderGeometry(0.01,0.01,ah,6),new T.MeshStandardMaterial({color:0xcccccc,roughness:0.15,metalness:0.95,emissive:0xffffff,emissiveIntensity:0.5}))
        an.position.y=0.06*s+h+ah/2;grp.add(an)
        beacon=new T.Mesh(new T.SphereGeometry(0.05*s,8,8),new T.MeshBasicMaterial({color:0xffffff}));beacon.position.y=0.06*s+h+ah+0.04*s;beacon.userData={baseScale:1};grp.add(beacon)
        beaconGlow=new T.Mesh(new T.SphereGeometry(0.12*s,8,8),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.25,depthWrite:false}));beaconGlow.position.copy(beacon.position);grp.add(beaconGlow)
        for(const r of[0.33,0.66]){const rg=new T.Mesh(new T.TorusGeometry(w*0.9,0.012,8,32),new T.MeshBasicMaterial({color:def.color,transparent:true,opacity:0.55,depthWrite:false}));rg.position.y=0.06*s+h*r;rg.userData={rotSpeed:r===0.33?0.8:-0.5};grp.add(rg);rings.push(rg)}
      }
      }catch(e){console.error('buildNode error:',def.key,e);pillar=new T.Mesh(new T.CylinderGeometry(pR*0.7,pR,pH,8),new T.MeshStandardMaterial({color:def.color,roughness:0.25,metalness:0.5,emissive:def.color,emissiveIntensity:0.3,transparent:true,opacity:0.85}));pillar.position.y=0.06*s+pH/2;grp.add(pillar)}
    }

    grp.position.set(def.x,0,def.z);scene.add(grp)
    containerData.push({pillar,edges,rings,beacon,beaconGlow,label:def.label,path:def.path,color:def.color,key:def.key})
    clickables.push(pillar)
  }
  MAIN_NODES.forEach(d=>buildNode(d,false))
  SUPPLIER_NODES.forEach(d=>buildNode(d,true))

  // ===== 流动粒子 =====
  function addFlowParticles(curve,color,count,size,T){
    const geo=new T.BufferGeometry();const pos=new Float32Array(count*3);const data=[]
    for(let i=0;i<count;i++){
      const td={t:Math.random(),speed:0.04+Math.random()*0.08};data.push(td)
      const pt=curve.getPoint(td.t);pos[i*3]=pt.x;pos[i*3+1]=pt.y+0.06;pos[i*3+2]=pt.z
    }
    geo.setAttribute('position',new T.BufferAttribute(pos,3))
    const pts=new T.Points(geo,new T.PointsMaterial({color,size,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.9}))
    scene.add(pts);flowSystems.push({curve,points:pts,data})
  }
  addFlowParticles(mainCurve,0x44ccff,50,0.07,T)
  branchCurves.forEach((c,i)=>addFlowParticles(c,SUPPLIER_NODES[i].color,15,0.06,T))

  // ===== 行驶小车 =====
  const carColors=[0xff6644,0x44cc88,0xffaa00,0xcc44ff,0x44aaff]
  const roadCars=[], laneOff=0.13
  for(let i=0;i<5;i++){
    const co=createCarModel(carColors[i],T)
    const mc=co.group;mc.scale.set(0.55,0.55,0.55)
    const dir=i<3?1:-1, lane=dir>0?1:-1
    const td={t:Math.random(),speed:0.025+Math.random()*0.04,dir,lane}
    const pt=mainCurve.getPoint(td.t)
    const tg=mainCurve.getTangent(td.t).normalize()
    const sn=new T.Vector3(-tg.z,0,tg.x).normalize()
    mc.position.copy(pt).addScaledVector(sn,laneOff*lane)
    mc.position.y+=0.05
    mc.rotation.y=Math.atan2(tg.x,tg.z)*(dir>0?1:-1)
    scene.add(mc);roadCars.push({car:mc,data:td})
  }
  flowSystems.push({curve:mainCurve,roadCars,laneOff})

  // ===== 环境粒子 =====
  const pc=250;const pg=new T.BufferGeometry();const pp=new Float32Array(pc*3)
  for(let i=0;i<pc;i++){
    const rad=2+Math.random()*8,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1)
    pp[i*3]=Math.cos(th)*Math.sin(ph)*rad;pp[i*3+1]=Math.sin(th)*Math.sin(ph)*rad*0.3+3;pp[i*3+2]=Math.cos(ph)*rad
  }
  pg.setAttribute('position',new T.BufferAttribute(pp,3))
  particles=new T.Points(pg,new T.PointsMaterial({color:0x4488cc,size:0.04,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0.4}))
  scene.add(particles)

  animate()
}

function animate(){
  animId=requestAnimationFrame(animate)
  const now=performance.now()*0.001, t=now
  const dt=lastFrameTime?Math.min(now-lastFrameTime,0.1):1/60;lastFrameTime=now

  camera.position.x=camDist*Math.sin(camPhi)*Math.cos(camTheta)+pivotX
  camera.position.y=camDist*Math.cos(camPhi)+pivotY
  camera.position.z=camDist*Math.sin(camPhi)*Math.sin(camTheta)+pivotZ
  camera.lookAt(pivotX,pivotY,pivotZ)

  if(particles)particles.rotation.y+=0.0004

  flowSystems.forEach(sys=>{
    if(sys.points&&sys.data){
      const arr=sys.points.geometry.attributes.position.array
      for(let i=0;i<sys.data.length;i++){
        sys.data[i].t+=sys.data[i].speed*dt;if(sys.data[i].t>1)sys.data[i].t-=1
        const pt=sys.curve.getPoint(sys.data[i].t)
        arr[i*3]=pt.x;arr[i*3+1]=pt.y+0.06;arr[i*3+2]=pt.z
      }
      sys.points.geometry.attributes.position.needsUpdate=true
    }
    if(sys.roadCars){
      sys.roadCars.forEach(rc=>{
        rc.data.t+=rc.data.speed*dt*rc.data.dir
        if(rc.data.t>1)rc.data.t-=1;if(rc.data.t<0)rc.data.t+=1
        const pt=sys.curve.getPoint(rc.data.t)
        const tg=sys.curve.getTangent(rc.data.t).normalize()
        const sn=new THREE.Vector3(-tg.z,0,tg.x).normalize()
        rc.car.position.copy(pt).addScaledVector(sn,(sys.laneOff||0.13)*rc.data.lane)
        rc.car.position.y+=0.06
        rc.car.rotation.y=Math.atan2(tg.x,tg.z)*(rc.data.dir>0?1:-1)
      })
    }
  })

  containerData.forEach((cd,i)=>{
    if(cd.rings)cd.rings.forEach(r=>{r.rotation.z+=r.userData.rotSpeed*dt*2})
    if(cd.beacon){
      const pulse=1+Math.sin(t*3.5+i*0.8)*0.22
      cd.beacon.scale.setScalar(pulse)
      if(cd.beaconGlow){cd.beaconGlow.scale.setScalar(pulse*1.1);cd.beaconGlow.material.opacity=0.15+Math.sin(t*3.5+i*0.8)*0.1}
    }
    if(cd.edges)cd.edges.material.opacity=0.25+Math.sin(t*1.5+i)*0.12
  })

  renderer?.render(scene,camera)
}

function onMouseDown(e){
  isDragging=true;dragMoved=false;dragPrevX=e.clientX;dragPrevY=e.clientY
  const el=document.getElementById('three-panel');if(el)el.style.cursor='grabbing'
}
function onMouseUp(){
  isDragging=false
  const el=document.getElementById('three-panel');if(el)el.style.cursor='grab'
}
function onWheel(e){
  e.preventDefault()
  const oldDist=camDist
  camDist+=e.deltaY*0.015;camDist=Math.max(2.5,Math.min(10,camDist))
  // 根据鼠标位置定向缩放
  if(camera&&scene){
    const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(mouseNDC.x,mouseNDC.y),camera)
    const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0.06)
    const target=new THREE.Vector3()
    if(rc.ray.intersectPlane(groundPlane,target)){
      const zoomF=(oldDist-camDist)/oldDist
      pivotX+=(target.x-pivotX)*zoomF
      pivotZ+=(target.z-pivotZ)*zoomF
    }
  }
}
function onMouseMove(e){
  if(!camera)return;const el=document.getElementById('three-panel');if(!el)return
  if(isDragging&&(e.buttons&1)){
    const dx=e.clientX-dragPrevX,dy=e.clientY-dragPrevY
    if(Math.abs(dx)>2||Math.abs(dy)>2)dragMoved=true
    camTheta+=dx*0.005;camPhi+=dy*0.005
    camPhi=Math.max(0.25,Math.min(1.45,camPhi))
    dragPrevX=e.clientX;dragPrevY=e.clientY
    el.style.cursor='grabbing';return
  }
  const rect=el.getBoundingClientRect()
  const mx=((e.clientX-rect.left)/rect.width)*2-1, my=-((e.clientY-rect.top)/rect.height)*2+1
  mouseNDC={x:mx,y:my}
  const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(mx,my),camera)
  const hits=rc.intersectObjects(clickables)
  if(hits.length>0){
    const cd=containerData.find(c=>c.pillar===hits[0].object)
    if(cd){
      el.style.cursor='pointer'
      tooltip3D.value={show:true,x:e.clientX,y:e.clientY,label:cd.label,value:stats.value[cd.key]||0,path:cd.path}
      if(cd.edges)cd.edges.material.opacity=0.9
      cd.pillar.material.emissive=new THREE.Color(cd.color)
      cd.pillar.material.emissiveIntensity=0.5;return
    }
  }
  el.style.cursor=isDragging?'grabbing':'grab';tooltip3D.value.show=false
  containerData.forEach(cd=>{cd.pillar.material.emissiveIntensity=0.3})
}
function onClick(e){
  if(dragMoved)return;if(!camera)return
  const el=document.getElementById('three-panel');if(!el)return
  const rect=el.getBoundingClientRect()
  const mx=((e.clientX-rect.left)/rect.width)*2-1, my=-((e.clientY-rect.top)/rect.height)*2+1
  const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(mx,my),camera)
  const hits=rc.intersectObjects(clickables)
  if(hits.length>0){const cd=containerData.find(c=>c.pillar===hits[0].object);if(cd)router.push(cd.path)}
}
function onResize(){
  if(renderer){const el=document.getElementById('three-panel');if(el){const w=el.clientWidth||800,h=el.clientHeight||420;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}}
}

onMounted(()=>{tick();clockTimer=setInterval(tick,1000);fetchStats();setTimeout(initThree,300);addEventListener('resize',onResize)})
onBeforeUnmount(()=>{clearInterval(clockTimer);removeEventListener('resize',onResize);if(animId)cancelAnimationFrame(animId);const el=document.getElementById('three-panel');if(el){el.removeEventListener('mousedown',onMouseDown);el.removeEventListener('mousemove',onMouseMove);el.removeEventListener('mouseup',onMouseUp);el.removeEventListener('click',onClick);el.removeEventListener('wheel',onWheel)};if(renderer){renderer.dispose();renderer.domElement.remove()}})
</script>

<template>
  <div class="layout">
    <AppSidebar />
    <div class="main">
      <div class="header"><h3>统计看板</h3><Logout /></div>
      <div class="content">

        <!-- Banner -->
        <div class="banner">
          <div><h1 class="b-title">供应链数据管理中心</h1><p class="b-sub">实时数据总览 · 关键指标一目了然</p></div>
          <div class="b-right"><div class="b-time">{{ currentTime }}</div><div class="b-user">您好，{{ userName }}</div></div>
        </div>

        <!-- 6 Cards -->
        <div class="cards">
          <div class="card">
            <div class="card-icon" style="background:#ecf5ff;color:#409eff;"><span class="card-emoji">📋</span></div>
            <div class="card-val">{{ stats.totalOrders }}</div><div class="card-label">采购订单</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background:#fdf6ec;color:#e6a23c;"><span class="card-emoji">⏳</span></div>
            <div class="card-val">{{ stats.pendingOrders }}</div><div class="card-label">待确认</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background:#f0f9eb;color:#67c23a;"><span class="card-emoji">🚚</span></div>
            <div class="card-val">{{ stats.totalDeliveries }}</div><div class="card-label">送货单</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background:#fdf6ec;color:#e6a23c;"><span class="card-emoji">📦</span></div>
            <div class="card-val">{{ stats.totalReceives }}</div><div class="card-label">收料记录</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background:#fef0f0;color:#f56c6c;"><span class="card-emoji">🏭</span></div>
            <div class="card-val">{{ stats.suppliers }}</div><div class="card-label">供应商</div>
          </div>
          <div class="card">
            <div class="card-icon" style="background:#f4f4f5;color:#909399;"><span class="card-emoji">📊</span></div>
            <div class="card-val">{{ stats.pendingDelivery || 0 }}</div><div class="card-label">待发货</div>
          </div>
        </div>

        <!-- 3 比率卡片（进度条） -->
        <div class="cards rate-cards">
          <div class="card rate-card">
            <div class="card-icon" style="background:#ecf5ff;color:#409eff;"><span class="card-emoji">✅</span></div>
            <div class="card-label">订单确认率</div>
            <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#409eff;width:0" :style="{width:completionRate+'%'}"></div></div><span class="rate-num" style="color:#409eff;">{{ completionRate }}%</span></div>
          </div>
          <div class="card rate-card">
            <div class="card-icon" style="background:#f0f9eb;color:#67c23a;"><span class="card-emoji">📤</span></div>
            <div class="card-label">订单发货率</div>
            <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#67c23a;width:0" :style="{width:deliveryRate+'%'}"></div></div><span class="rate-num" style="color:#67c23a;">{{ deliveryRate }}%</span></div>
          </div>
          <div class="card rate-card">
            <div class="card-icon" style="background:#fdf6ec;color:#e6a23c;"><span class="card-emoji">📥</span></div>
            <div class="card-label">订单收货率</div>
            <div class="rate-wrap"><div class="rate-bg"><div class="rate-fg" style="background:#e6a23c;width:0" :style="{width:receiveRate+'%'}"></div></div><span class="rate-num" style="color:#e6a23c;">{{ receiveRate }}%</span></div>
          </div>
        </div>

        <!-- 3D 视窗 -->
        <div class="panel-3d">
          <div class="panel-3d-head">
            <span class="panel-3d-title">供应链数字孪生</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="panel-3d-hint">拖拽旋转 · 滚轮缩放 · 点击跳转</span>
              <button class="reset-btn" @click="resetView" title="重置视角">↺</button>
            </div>
          </div>
          <div id="three-panel"></div>
          <Teleport to="body"><div v-if="tooltip3D.show" class="three-tip" :style="{left:tooltip3D.x+'px',top:(tooltip3D.y-60)+'px'}"><div class="tt-label">{{ tooltip3D.label }}</div><div class="tt-val">{{ tooltip3D.value }}</div><div class="tt-click">点击查看详情 →</div></div></Teleport>
        </div>

      </div>
    </div>
  </div>
</template>

<style>
.three-tip{position:fixed;z-index:9999;pointer-events:none;background:rgba(26,36,48,.95);color:#c8d6e5;padding:8px 14px;border-radius:8px;border:1px solid rgba(100,160,220,.3);font-size:12px;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4);}
.three-tip .tt-label{color:#7a8a9a;font-size:10px;letter-spacing:1px;}
.three-tip .tt-val{font-size:20px;font-weight:700;color:#5aacff;}
.three-tip .tt-click{color:#6a7a90;font-size:10px;margin-top:2px;}
</style>

<style scoped>
.layout{display:flex;min-height:100vh}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.header{height:60px;background:#fff;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee}
.content{padding:20px;flex:1;overflow-y:auto;background:#f0f4f8}

.banner{background:linear-gradient(135deg,#2b7af0,#1a5cc8);border-radius:12px;padding:28px 32px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;color:#fff;box-shadow:0 4px 16px rgba(43,122,240,.3)}
.b-title{font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:1px}
.b-sub{font-size:13px;opacity:.85;margin:0}
.b-right{text-align:right}
.b-time{font-size:14px;font-family:'SF Mono','Cascadia Code','Consolas',monospace;opacity:.9}
.b-user{font-size:15px;font-weight:600;margin-top:4px}

.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}
.card{background:#fff;border-radius:10px;padding:20px 16px;text-align:center;border:1px solid #ebeef5;transition:all .25s}
.card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.08);border-color:#409eff}
.card-icon{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 10px}
.card-val{font-size:28px;font-weight:700;color:#303133;line-height:1.2}
.card-label{font-size:12px;color:#909399;margin-top:4px}
.card-sub{margin-top:8px;padding-top:8px;border-top:1px solid #f0f0f0;font-size:11px;color:#909399}
.card-emoji{font-size:18px;line-height:1}
.card-bar-wrap{display:flex;align-items:center;gap:6px;margin-top:8px}
.card-bar{flex:1;height:5px;background:#ebeef5;border-radius:3px;overflow:hidden}
.card-bar-fill{height:100%;background:#409eff;border-radius:3px;transition:width .6s ease}
.card-bar-fill.warn{background:#e6a23c}
.card-bar-fill.success{background:#67c23a}
.card-rate{font-size:11px;font-weight:600;color:#606266;min-width:32px;text-align:right}

.panel-3d{background:#1a2430;border-radius:10px;overflow:hidden;border:1px solid #2a3a4a;margin-bottom:20px;box-shadow:0 2px 16px rgba(0,0,0,.2);user-select:none;-webkit-user-select:none}
.panel-3d-head{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;border-bottom:1px solid #2a3a4a;background:#1e2835;user-select:none;-webkit-user-select:none}
.panel-3d-title{font-size:15px;font-weight:600;color:#c8d6e5;letter-spacing:1px}
.panel-3d-hint{font-size:11px;color:#6a7a90}
#three-panel{width:100%;height:420px;user-select:none;-webkit-user-select:none}
.reset-btn{width:26px;height:26px;border-radius:50%;border:1px solid #556070;background:#2a3a4a;color:#aabbcc;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;transition:all .2s;line-height:1}
.reset-btn:hover{background:#3a4a5a;color:#fff;border-color:#778899}

.rate-cards{grid-template-columns:repeat(3,1fr)!important;margin-bottom:20px}
.rate-card .card-val{font-size:32px}
.rate-wrap{display:flex;align-items:center;gap:8px;margin-top:8px}
.rate-bg{flex:1;height:6px;background:#ebeef5;border-radius:3px;overflow:hidden}
.rate-fg{height:100%;border-radius:3px;transition:width .6s ease}
.rate-num{font-size:14px;font-weight:700;min-width:36px;text-align:right}

@media(max-width:1200px){.cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.cards{grid-template-columns:repeat(2,1fr)}.banner{flex-direction:column;text-align:center;gap:8px}}
</style>
