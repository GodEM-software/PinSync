import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js'
import { LWOLoader } from 'three/examples/jsm/loaders/LWOLoader.js'
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js'
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js'
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js'
import { VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js'
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js'
import { KMZLoader } from 'three/examples/jsm/loaders/KMZLoader.js'
import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { MD2Loader } from 'three/examples/jsm/loaders/MD2Loader.js'
import { SPLATLoader } from 'three/examples/jsm/loaders/SPLATLoader.js'
import { KSPLATLoader } from 'three/examples/jsm/loaders/KSPLATLoader.js'
import { SPZLoader } from 'three/examples/jsm/loaders/SPZLoader.js'
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader.js'
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js'
import { Box, Grid, MousePointerClick, RotateCcw, RotateCw } from 'lucide-react'
import type { ItemRendererProps, Model3DFormat, Model3DItem } from '../types/board'

interface OcctResult {
  success: boolean
  error?: string
  meshes?: Array<{
    name?: string
    color?: [number, number, number]
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index: { array: number[] }
  }>
}

function geometryToPoints(geometry: THREE.BufferGeometry): THREE.Points {
  const mat = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: Boolean(geometry.attributes.color),
    color: geometry.attributes.color ? 0xffffff : 0x93c5fd
  })
  return new THREE.Points(geometry, mat)
}

function geometryToMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals()
  }
  const hasVertexColors = Boolean(geometry.attributes.color)
  const material = new THREE.MeshStandardMaterial({
    color: hasVertexColors ? 0xffffff : 0xc8d0da,
    vertexColors: hasVertexColors,
    roughness: 0.45,
    metalness: 0.15,
    side: THREE.DoubleSide
  })
  return new THREE.Mesh(geometry, material)
}

function parseOffText(text: string): THREE.Mesh {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter((l) => l.length > 0)

  let idx = 0
  if (lines[0]?.toUpperCase().startsWith('OFF')) idx++
  const counts = lines[idx++].split(/\s+/).map(Number)
  const numVerts = counts[0] || 0
  const numFaces = counts[1] || 0

  const verts: number[] = []
  for (let i = 0; i < numVerts && idx < lines.length; i++) {
    const parts = lines[idx++].split(/\s+/).map(Number)
    verts.push(parts[0] || 0, parts[1] || 0, parts[2] || 0)
  }

  const indices: number[] = []
  for (let i = 0; i < numFaces && idx < lines.length; i++) {
    const parts = lines[idx++].split(/\s+/).map(Number)
    const n = parts[0] || 0
    for (let k = 1; k + 1 < n; k++) {
      indices.push(parts[1], parts[k + 1], parts[k + 2])
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(indices)
  return geometryToMesh(geo)
}

function parseX3dText(xmlText: string): THREE.Group {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const group = new THREE.Group()
  const faceSets = Array.from(doc.getElementsByTagName('IndexedFaceSet'))

  for (const fs of faceSets) {
    const coordEl = fs.getElementsByTagName('Coordinate')[0]
    const pointStr = coordEl?.getAttribute('point') || ''
    const idxStr = fs.getAttribute('coordIndex') || ''
    if (!pointStr || !idxStr) continue

    const pts = pointStr
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    const rawIdx = idxStr
      .trim()
      .split(/[\s,]+/)
      .map(Number)

    const indices: number[] = []
    let poly: number[] = []
    for (const val of rawIdx) {
      if (val === -1) {
        for (let k = 1; k + 1 < poly.length; k++) {
          indices.push(poly[0], poly[k], poly[k + 1])
        }
        poly = []
      } else {
        poly.push(val)
      }
    }
    if (poly.length >= 3) {
      for (let k = 1; k + 1 < poly.length; k++) {
        indices.push(poly[0], poly[k], poly[k + 1])
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    geo.setIndex(indices)
    group.add(geometryToMesh(geo))
  }

  return group
}

function buildOcctGroup(res: OcctResult): THREE.Group {
  if (!res?.success || !res.meshes || res.meshes.length === 0) {
    throw new Error(res?.error || 'Failed to triangulate CAD model')
  }
  const group = new THREE.Group()
  for (const m of res.meshes) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3))
    if (m.attributes.normal?.array) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3))
    } else {
      geo.computeVertexNormals()
    }
    geo.setIndex(m.index.array)

    const color = m.color
      ? new THREE.Color(m.color[0], m.color[1], m.color[2])
      : new THREE.Color(0xc8d0da)
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geo, mat)
    if (m.name) mesh.name = m.name
    group.add(mesh)
  }
  return group
}

async function loadFromZip(
  src: string,
  renderer: THREE.WebGLRenderer
): Promise<{ obj: THREE.Object3D; revoke: () => void }> {
  const resp = await fetch(src)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const buf = new Uint8Array(await resp.arrayBuffer())
  const files = unzipSync(buf)

  const blobUrls = new Map<string, string>()
  const priorityExts = ['glb', 'gltf', 'obj', 'fbx', 'stl', 'dae', 'ply', '3ds', '3mf', 'usdz']
  let entryKey: string | null = null
  let entryExt: Model3DFormat | null = null

  for (const name of Object.keys(files)) {
    if (name.endsWith('/')) continue
    const blob = new Blob([files[name]])
    const url = URL.createObjectURL(blob)
    blobUrls.set(name.toLowerCase(), url)
    const base = name.split('/').pop()?.toLowerCase() || name.toLowerCase()
    if (!blobUrls.has(base)) blobUrls.set(base, url)

    const dot = name.lastIndexOf('.')
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
    if (priorityExts.includes(ext)) {
      if (!entryKey || priorityExts.indexOf(ext) < priorityExts.indexOf(entryExt || '')) {
        entryKey = name
        entryExt = ext as Model3DFormat
      }
    }
  }

  const revoke = (): void => {
    for (const u of blobUrls.values()) URL.revokeObjectURL(u)
  }

  if (!entryKey || !entryExt) {
    revoke()
    throw new Error('No supported 3D model found inside archive')
  }

  const manager = new THREE.LoadingManager()
  manager.setURLModifier((requestedUrl) => {
    const clean = decodeURIComponent(requestedUrl.split('?')[0].split('#')[0]).toLowerCase()
    if (blobUrls.has(clean)) return blobUrls.get(clean)!
    const base = clean.split('/').pop() || clean
    if (blobUrls.has(base)) return blobUrls.get(base)!
    return requestedUrl
  })

  const entryUrl = blobUrls.get(entryKey.toLowerCase())!
  const obj = await loadModelObject(entryUrl, entryExt, renderer, undefined, manager)
  return { obj, revoke }
}

async function loadModelObject(
  src: string,
  format: Model3DFormat,
  renderer: THREE.WebGLRenderer,
  filePath?: string,
  manager?: THREE.LoadingManager
): Promise<THREE.Object3D> {
  switch (format) {
    case 'glb':
    case 'gltf': {
      const loader = new GLTFLoader(manager)
      const draco = new DRACOLoader(manager)
      draco.setDecoderPath('local-media://three-libs/draco/gltf/')
      loader.setDRACOLoader(draco)
      loader.setMeshoptDecoder(MeshoptDecoder)
      const ktx2 = new KTX2Loader(manager)
      ktx2.setTranscoderPath('local-media://three-libs/basis/')
      ktx2.detectSupport(renderer)
      loader.setKTX2Loader(ktx2)
      const gltf = await loader.loadAsync(src)
      draco.dispose()
      ktx2.dispose()
      return gltf.scene
    }
    case 'obj': {
      const objLoader = new OBJLoader(manager)
      const mtlUrl = src.replace(/\.obj(\?.*)?$/i, '.mtl')
      if (mtlUrl !== src) {
        try {
          const check = await fetch(mtlUrl, { method: 'HEAD' })
          if (check.ok) {
            const mtlLoader = new MTLLoader(manager)
            const materials = await mtlLoader.loadAsync(mtlUrl)
            materials.preload()
            objLoader.setMaterials(materials)
          }
        } catch {
          // Load OBJ without MTL when no sibling .mtl exists
        }
      }
      return await objLoader.loadAsync(src)
    }
    case 'stl':
      return geometryToMesh(await new STLLoader(manager).loadAsync(src))
    case 'fbx':
      return await new FBXLoader(manager).loadAsync(src)
    case 'dae': {
      const collada = await new ColladaLoader(manager).loadAsync(src)
      if (!collada?.scene) throw new Error('Empty Collada scene')
      return collada.scene
    }
    case 'ply':
      return geometryToMesh(await new PLYLoader(manager).loadAsync(src))
    case '3ds':
      return await new TDSLoader(manager).loadAsync(src)
    case '3mf':
      return await new ThreeMFLoader(manager).loadAsync(src)
    case 'amf':
      return await new AMFLoader(manager).loadAsync(src)
    case 'lwo': {
      const res = await new LWOLoader(manager).loadAsync(src)
      const group = new THREE.Group()
      res.meshes.forEach((m) => group.add(m))
      return group
    }
    case 'usd':
    case 'usda':
    case 'usdc':
      return await new USDLoader(manager).loadAsync(src)
    case 'usdz':
      return await new USDZLoader(manager).loadAsync(src)
    case 'wrl':
    case 'vrml':
      return await new VRMLLoader(manager).loadAsync(src)
    case 'vtk':
    case 'vtp':
      return geometryToMesh(await new VTKLoader(manager).loadAsync(src))
    case 'xyz': {
      const geo = await new XYZLoader(manager).loadAsync(src)
      const mat = new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: Boolean(geo.attributes.color),
        color: geo.attributes.color ? 0xffffff : 0x93c5fd
      })
      return new THREE.Points(geo, mat)
    }
    case 'pcd':
      return await new PCDLoader(manager).loadAsync(src)
    case 'vox': {
      const res = await new VOXLoader(manager).loadAsync(src)
      return res.scene
    }
    case 'kmz': {
      const kmz = await new KMZLoader(manager).loadAsync(src)
      return kmz.scene
    }
    case 'gcode':
      return await new GCodeLoader(manager).loadAsync(src)
    case 'bvh': {
      const res = await new BVHLoader(manager).loadAsync(src)
      const helper = new THREE.SkeletonHelper(res.skeleton.bones[0])
      const group = new THREE.Group()
      group.add(res.skeleton.bones[0])
      group.add(helper)
      return group
    }
    case 'md2': {
      const geo = await new MD2Loader(manager).loadAsync(src)
      return geometryToMesh(geo)
    }
    case 'splat':
      return geometryToPoints(await new SPLATLoader(manager).loadAsync(src))
    case 'ksplat':
      return geometryToPoints(await new KSPLATLoader(manager).loadAsync(src))
    case 'spz':
      return geometryToPoints(await new SPZLoader(manager).loadAsync(src))
    case '3dm': {
      const loader = new Rhino3dmLoader(manager)
      return await loader.loadAsync(src)
    }
    case 'off': {
      const resp = await fetch(src)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return parseOffText(await resp.text())
    }
    case 'x3d': {
      const resp = await fetch(src)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return parseX3dText(await resp.text())
    }
    case 'step':
    case 'stp':
    case 'iges':
    case 'igs':
    case 'brep': {
      const targetPath =
        filePath || decodeURIComponent(new URL(src).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
      const res = (await window.api.parseCadFile(targetPath)) as OcctResult
      return buildOcctGroup(res)
    }
    case 'zip': {
      const { obj } = await loadFromZip(src, renderer)
      return obj
    }
  }
}

function centerAndScaleObject(obj: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(obj)
  if (box.isEmpty()) return
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const scale = 2.2 / maxDim
  obj.scale.multiplyScalar(scale)

  const scaledBox = new THREE.Box3().setFromObject(obj)
  const scaledCenter = new THREE.Vector3()
  scaledBox.getCenter(scaledCenter)
  obj.position.sub(scaledCenter)
}

function applyWireframe(obj: THREE.Object3D, wireframe: boolean): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (m && 'wireframe' in m) {
          ;(m as THREE.MeshStandardMaterial).wireframe = wireframe
        }
      }
    }
  })
}

export const Model3DItemView: React.FC<ItemRendererProps<Model3DItem>> = ({
  item,
  isInteractive,
  onUpdate,
  onRequestInteract
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const modelRef = useRef<THREE.Object3D | null>(null)
  const gridRef = useRef<THREE.GridHelper | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  const autoRotateRef = useRef(item.autoRotate)
  const wireframeRef = useRef(item.wireframe)
  const showGridRef = useRef(item.showGrid)
  const bgRef = useRef(item.backgroundColor)
  const sizeRef = useRef({ width: item.width, height: item.height })
  const filePathRef = useRef(item.filePath)

  useEffect(() => {
    autoRotateRef.current = item.autoRotate
  }, [item.autoRotate])

  useEffect(() => {
    wireframeRef.current = item.wireframe
    if (modelRef.current) applyWireframe(modelRef.current, item.wireframe)
  }, [item.wireframe])

  useEffect(() => {
    showGridRef.current = item.showGrid
    if (gridRef.current) gridRef.current.visible = item.showGrid
  }, [item.showGrid])

  useEffect(() => {
    bgRef.current = item.backgroundColor
    sizeRef.current = { width: item.width, height: item.height }
    filePathRef.current = item.filePath
  }, [item.backgroundColor, item.width, item.height, item.filePath])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    let disposed = false
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(bgRef.current || '#15171c')

    const width = Math.max(120, container.clientWidth || sizeRef.current.width)
    const height = Math.max(120, container.clientHeight || sizeRef.current.height)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 100)
    camera.position.set(2.8, 2.0, 3.2)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xf2f6ff, 0x2a2e38, 1.15)
    scene.add(hemi)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55)
    keyLight.position.set(4, 6, 5)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x88b8ff, 0.75)
    rimLight.position.set(-4, 2, -4)
    scene.add(rimLight)

    const grid = new THREE.GridHelper(6, 12, 0x4b5568, 0x2c313c)
    grid.position.y = -1.1
    grid.visible = showGridRef.current
    scene.add(grid)
    gridRef.current = grid

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 0, 0)
    controls.update()
    controlsRef.current = controls

    loadModelObject(item.src, item.format, renderer, filePathRef.current)
      .then((obj) => {
        if (disposed) return
        centerAndScaleObject(obj)
        applyWireframe(obj, wireframeRef.current)
        scene.add(obj)
        modelRef.current = obj
        setStatus('ready')
      })
      .catch((err) => {
        if (disposed) return
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Unable to parse 3D model')
      })

    const resizeObserver = new ResizeObserver(() => {
      if (disposed || !mountRef.current) return
      const w = Math.max(80, mountRef.current.clientWidth)
      const h = Math.max(80, mountRef.current.clientHeight)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    let rafId = 0
    const animate = (): void => {
      if (disposed) return
      rafId = requestAnimationFrame(animate)
      controls.autoRotate = autoRotateRef.current
      controls.autoRotateSpeed = 2.0
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      modelRef.current = null
      gridRef.current = null
    }
  }, [item.src, item.format])

  const resetCamera = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(2.8, 2.0, 3.2)
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }

  return (
    <div className="item-model3d-container">
      <div ref={mountRef} className="model3d-canvas-host" />

      <div className="item-badge">
        3D · {item.format.toUpperCase()} · {item.name}
      </div>

      {status === 'loading' && <div className="model3d-overlay-msg">Loading 3D model…</div>}

      {status === 'error' && (
        <div className="item-fallback">
          <span>3D load error</span>
          <small>{errorMsg || item.name}</small>
        </div>
      )}

      {!isInteractive && status === 'ready' && (
        <div className="interact-shield" title="Drag to move · Double-click to orbit 3D model">
          <span className="interact-hint">Double-click to orbit 3D</span>
        </div>
      )}

      <div
        className="media-controls-bar"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={`media-btn ${isInteractive ? 'active' : ''}`}
          title={isInteractive ? 'Orbiting (Esc to exit)' : 'Enable 3D Orbit'}
          onClick={onRequestInteract}
        >
          <MousePointerClick size={13} />
        </button>

        <button
          className={`media-btn ${item.autoRotate ? 'active' : ''}`}
          title="Turntable Auto-Rotate"
          onClick={() => onUpdate({ autoRotate: !item.autoRotate })}
        >
          <RotateCw size={13} />
        </button>

        <button
          className={`media-btn ${item.wireframe ? 'active' : ''}`}
          title="Toggle Wireframe"
          onClick={() => onUpdate({ wireframe: !item.wireframe })}
        >
          <Box size={13} />
        </button>

        <button
          className={`media-btn ${item.showGrid ? 'active' : ''}`}
          title="Toggle Grid"
          onClick={() => onUpdate({ showGrid: !item.showGrid })}
        >
          <Grid size={13} />
        </button>

        <button className="media-btn" title="Reset Camera" onClick={resetCamera}>
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  )
}
