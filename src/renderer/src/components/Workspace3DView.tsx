import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Layers, Maximize2, RotateCcw, X } from 'lucide-react'
import type { BoardItem, BoardTheme } from '../types/board'

interface Workspace3DViewProps {
  items: BoardItem[]
  theme: BoardTheme
  onExit3D: () => void
  onSelectItem: (id: string) => void
  onOpen3DEditor: (item: BoardItem) => void
}

const THEME_BG: Record<BoardTheme, number> = {
  charcoal: 0x14161c,
  obsidian: 0x090a0e,
  neutral: 0x242730,
  slate: 0x151e2c,
  blueprint: 0x0e1a2d
}

function makeCardTexture(item: BoardItem): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = Math.max(160, Math.round((512 * item.height) / Math.max(1, item.width)))
  const ctx = canvas.getContext('2d')!

  const w = canvas.width
  const h = canvas.height

  if (item.type === 'drawing') {
    ctx.clearRect(0, 0, w, h)
    if (item.points.length > 0) {
      const xs = item.points.map((p) => p.x)
      const ys = item.points.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const sx = w / Math.max(1, item.width)
      const sy = h / Math.max(1, item.height)
      ctx.strokeStyle = item.color
      ctx.lineWidth = Math.max(2, item.strokeWidth * sx)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = item.opacity
      ctx.beginPath()
      item.points.forEach((p, idx) => {
        const px = (p.x - minX) * sx
        const py = (p.y - minY) * sy
        if (idx === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  // Dark glassmorphic card background
  ctx.fillStyle =
    item.type === 'swatch'
      ? item.hex
      : item.type === 'flowchart'
        ? item.fillColor
        : item.type === 'text'
          ? '#1e222d'
          : '#161922'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = item.type === 'flowchart' ? item.borderColor : 'rgba(148, 163, 184, 0.35)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, w - 4, h - 4)

  ctx.fillStyle =
    item.type === 'text' ? item.color : item.type === 'flowchart' ? item.textColor : '#e2e8f0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let label = item.name
  if (item.type === 'text') label = item.text || 'Text'
  else if (item.type === 'flowchart') label = item.label
  else if (item.type === 'code') label = `${item.language.toUpperCase()} · ${item.name}`
  else if (item.type === 'swatch') label = item.hex
  else if (item.type === 'model3d') label = `3D · ${item.format.toUpperCase()}\n${item.name}`

  const lines = label.split('\n').slice(0, 4)
  ctx.font = '600 28px Inter, Segoe UI, sans-serif'
  const lineH = 36
  const startY = h / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line.slice(0, 34), w / 2, startY + i * lineH, w - 36)
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export const Workspace3DView: React.FC<Workspace3DViewProps> = ({
  items,
  theme,
  onExit3D,
  onSelectItem,
  onOpen3DEditor
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshMapRef = useRef<Map<string, THREE.Object3D>>(new Map())

  const [depthSpread, setDepthSpread] = useState(1)
  const [focusedItem, setFocusedItem] = useState<BoardItem | null>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(THEME_BG[theme] || 0x14161c)
    scene.fog = new THREE.FogExp2(THEME_BG[theme] || 0x14161c, 0.015)

    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 400)
    camera.position.set(0, 5, 18)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 2, 0)
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
    dirLight.position.set(8, 16, 12)
    scene.add(dirLight)

    const grid = new THREE.GridHelper(60, 60, 0x3b82f6, 0x262d3d)
    grid.position.y = -2
    scene.add(grid)

    const texLoader = new THREE.TextureLoader()
    const createdTextures: THREE.Texture[] = []
    const createdGeos: THREE.BufferGeometry[] = []
    const createdMats: THREE.Material[] = []
    const pickables: THREE.Object3D[] = []
    meshMapRef.current.clear()

    // Compute board center so items are centered around origin
    const avgX = items.length > 0 ? items.reduce((s, it) => s + it.x, 0) / items.length : 0
    const avgY = items.length > 0 ? items.reduce((s, it) => s + it.y, 0) / items.length : 0
    const scale = 0.016

    items.forEach((item, idx) => {
      const pw = Math.max(0.6, item.width * scale)
      const ph = Math.max(0.6, item.height * scale)
      const wx = (item.x - avgX) * scale
      const wy = -(item.y - avgY) * scale + 2.2
      const wz = (item.zIndex - items.length / 2) * 0.25 * depthSpread + (idx % 3) * 0.02

      const group = new THREE.Group()
      group.position.set(wx, wy, wz)
      group.rotation.z = THREE.MathUtils.degToRad(-item.rotation)
      group.userData.itemId = item.id

      if (item.type === 'model3d') {
        const geo = new THREE.BoxGeometry(pw * 0.72, ph * 0.72, Math.min(pw, ph) * 0.72)
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          roughness: 0.35,
          metalness: 0.45,
          transparent: true,
          opacity: 0.88
        })
        createdGeos.push(geo)
        createdMats.push(mat)
        const cube = new THREE.Mesh(geo, mat)
        cube.userData.itemId = item.id
        group.add(cube)
        pickables.push(cube)

        const labelTex = makeCardTexture(item)
        createdTextures.push(labelTex)
        const badgeGeo = new THREE.PlaneGeometry(pw, ph * 0.32)
        const badgeMat = new THREE.MeshBasicMaterial({
          map: labelTex,
          transparent: true,
          side: THREE.DoubleSide
        })
        createdGeos.push(badgeGeo)
        createdMats.push(badgeMat)
        const badge = new THREE.Mesh(badgeGeo, badgeMat)
        badge.position.y = -ph * 0.55
        group.add(badge)
      } else {
        const geo = new THREE.PlaneGeometry(pw, ph)
        createdGeos.push(geo)
        let mat: THREE.MeshBasicMaterial
        if (item.type === 'image') {
          const tex = texLoader.load(item.src)
          tex.colorSpace = THREE.SRGBColorSpace
          createdTextures.push(tex)
          mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: item.opacity,
            side: THREE.DoubleSide
          })
        } else {
          const tex = makeCardTexture(item)
          createdTextures.push(tex)
          mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: item.opacity,
            side: THREE.DoubleSide
          })
        }
        createdMats.push(mat)
        const plane = new THREE.Mesh(geo, mat)
        plane.userData.itemId = item.id
        group.add(plane)
        pickables.push(plane)
      }

      scene.add(group)
      meshMapRef.current.set(item.id, group)
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0

    const onPointerDown = (e: PointerEvent): void => {
      downX = e.clientX
      downY = e.clientY
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(pickables, false)
      if (hits.length > 0) {
        const itemId = hits[0].object.userData.itemId as string | undefined
        if (itemId) {
          const found = items.find((it) => it.id === itemId) || null
          setFocusedItem(found)
          onSelectItem(itemId)
        }
      } else {
        setFocusedItem(null)
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth || window.innerWidth
      const nh = container.clientHeight || window.innerHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    })
    ro.observe(container)

    let rafId = 0
    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      createdTextures.forEach((t) => t.dispose())
      createdGeos.forEach((g) => g.dispose())
      createdMats.forEach((m) => m.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [depthSpread, items, onSelectItem, theme])

  const focusOnSelected = (): void => {
    if (!focusedItem || !cameraRef.current || !controlsRef.current) return
    const obj = meshMapRef.current.get(focusedItem.id)
    if (!obj) return
    controlsRef.current.target.copy(obj.position)
    cameraRef.current.position.set(obj.position.x, obj.position.y + 0.8, obj.position.z + 6)
    controlsRef.current.update()
  }

  const resetCamera = (): void => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.set(0, 5, 18)
    controlsRef.current.target.set(0, 2, 0)
    controlsRef.current.update()
  }

  return (
    <div className="workspace-3d-overlay">
      <div ref={mountRef} className="workspace-3d-canvas" />

      <div className="workspace-3d-hud">
        <div className="hud-pill">
          <Box size={14} color="#60a5fa" />
          <strong>3D Spatial Mode</strong>
          <span className="hud-sep">·</span>
          <span>Drag to Orbit · Right-Drag to Pan · Scroll to Zoom</span>
        </div>

        <div className="hud-pill">
          <Layers size={13} />
          <span>Depth</span>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.1}
            value={depthSpread}
            onChange={(e) => setDepthSpread(parseFloat(e.target.value))}
          />
          <button className="btn-secondary small" onClick={resetCamera}>
            <RotateCcw size={12} /> Reset View
          </button>
          <button className="btn-primary small" onClick={onExit3D}>
            <X size={12} /> Return to 2D
          </button>
        </div>
      </div>

      {focusedItem && (
        <div className="workspace-3d-selection">
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{focusedItem.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Type: {focusedItem.type}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-secondary small" onClick={focusOnSelected}>
              <Maximize2 size={12} /> Focus
            </button>
            {focusedItem.type === 'model3d' && (
              <button className="btn-primary small" onClick={() => onOpen3DEditor(focusedItem)}>
                Edit 3D Model
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
