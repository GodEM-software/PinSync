import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Layers, Maximize2, RotateCcw, X } from 'lucide-react'
import type { BoardItem, BoardTheme } from '../types/board'
import { centerAndScaleObject, loadModelObject } from '../items/Model3DItem'

interface Workspace3DViewProps {
  items: BoardItem[]
  theme: BoardTheme
  onExit3D: () => void
  onSelectItem: (id: string) => void
  onOpen3DEditor: (item: BoardItem) => void
}

const THEME_BG: Record<BoardTheme, number> = {
  light: 0xeef2f7,
  charcoal: 0x14161c,
  obsidian: 0x090a0e,
  neutral: 0x242730,
  slate: 0x151e2c,
  blueprint: 0x0e1a2d
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const paragraphs = text.split(/\r?\n/)
  const out: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`
      if (ctx.measureText(test).width <= maxWidth) {
        line = test
      } else {
        out.push(line)
        line = words[i]
        if (out.length >= maxLines) break
      }
    }
    if (out.length < maxLines) out.push(line)
    if (out.length >= maxLines) break
  }
  return out.slice(0, maxLines)
}

function makeCardTexture(item: BoardItem): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = Math.max(180, Math.round((640 * item.height) / Math.max(1, item.width)))
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

  ctx.fillStyle =
    item.type === 'swatch'
      ? item.hex
      : item.type === 'flowchart'
        ? item.fillColor
        : item.type === 'text'
          ? '#ffffff'
          : '#f8fafc'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = item.type === 'flowchart' ? item.borderColor : '#cbd5e1'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, w - 4, h - 4)

  ctx.fillStyle =
    item.type === 'text'
      ? item.color === '#f1f5f9'
        ? '#0f172a'
        : item.color
      : item.type === 'flowchart'
        ? item.textColor
        : '#0f172a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let label = item.name
  if (item.type === 'text') label = item.text || 'Text'
  else if (item.type === 'flowchart') label = item.label
  else if (item.type === 'code')
    label = `${item.language.toUpperCase()} · ${item.name}\n${item.code}`
  else if (item.type === 'swatch') label = item.hex

  ctx.font = '600 24px Inter, Segoe UI, sans-serif'
  const maxLines = Math.max(2, Math.floor((h - 40) / 32))
  const lines = wrapCanvasText(ctx, label, w - 48, maxLines)
  const lineH = 30
  const startY = h / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, startY + i * lineH, w - 44)
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
  const meshMapRef = useRef<Map<string, { group: THREE.Group; baseZ: number }>>(new Map())
  const homeViewRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 }>({
    pos: new THREE.Vector3(0, 4, 16),
    target: new THREE.Vector3(0, 1.5, 0)
  })
  const renderOnceRef = useRef<() => void>(() => {})
  const onSelectRef = useRef(onSelectItem)

  useEffect(() => {
    onSelectRef.current = onSelectItem
  }, [onSelectItem])

  const [depthSpread, setDepthSpread] = useState(1)
  const [focusedItem, setFocusedItem] = useState<BoardItem | null>(null)

  const requestRender = useCallback(() => {
    renderOnceRef.current()
  }, [])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const isLight = theme === 'light'
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(THEME_BG[theme] ?? 0xeef2f7)

    const w = container.clientWidth || window.innerWidth
    const h = container.clientHeight || window.innerHeight
    const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 400)
    camera.position.set(0, 4, 16)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(w, h)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false
    controls.target.set(0, 1.5, 0)
    controlsRef.current = controls

    let rafPending = false
    const scheduleRender = (): void => {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(() => {
        rafPending = false
        renderer.render(scene, camera)
      })
    }
    renderOnceRef.current = scheduleRender
    controls.addEventListener('change', scheduleRender)

    scene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
    dirLight.position.set(8, 16, 12)
    scene.add(dirLight)

    const grid = new THREE.GridHelper(
      50,
      50,
      isLight ? 0x94a3b8 : 0x3b82f6,
      isLight ? 0xdbe2ea : 0x262d3d
    )
    grid.position.y = -2.2
    scene.add(grid)

    const createdTextures: THREE.Texture[] = []
    const createdGeos: THREE.BufferGeometry[] = []
    const createdMats: THREE.Material[] = []
    const pickables: THREE.Object3D[] = []
    meshMapRef.current.clear()

    const avgX = items.length > 0 ? items.reduce((s, it) => s + it.x, 0) / items.length : 0
    const avgY = items.length > 0 ? items.reduce((s, it) => s + it.y, 0) / items.length : 0
    const scale = 0.014

    let minWorldY = -2
    let minWorldX = -6
    let maxWorldX = 6
    let maxWorldY = 4

    items.forEach((item, idx) => {
      const pw = Math.max(0.6, item.width * scale)
      const ph = Math.max(0.6, item.height * scale)
      const wx = (item.x - avgX) * scale
      const wy = -(item.y - avgY) * scale
      const baseZ = (item.zIndex - items.length / 2) * 0.25 + (idx % 3) * 0.02

      minWorldY = Math.min(minWorldY, wy - ph / 2)
      maxWorldY = Math.max(maxWorldY, wy + ph / 2)
      minWorldX = Math.min(minWorldX, wx - pw / 2)
      maxWorldX = Math.max(maxWorldX, wx + pw / 2)

      const group = new THREE.Group()
      group.position.set(wx, wy, baseZ * depthSpread)
      group.rotation.z = THREE.MathUtils.degToRad(-item.rotation)
      group.userData.itemId = item.id

      if (item.type === 'model3d') {
        const modelGroup = new THREE.Group()
        group.add(modelGroup)
        void loadModelObject(item.src, item.format, renderer, item.filePath)
          .then((obj) => {
            centerAndScaleObject(obj)
            const s = Math.max(0.7, Math.min(pw, ph) * 0.45)
            obj.scale.multiplyScalar(s)
            obj.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                c.userData.itemId = item.id
                pickables.push(c)
              }
            })
            modelGroup.add(obj)
            scheduleRender()
          })
          .catch(() => {
            const geo = new THREE.BoxGeometry(pw * 0.6, ph * 0.6, Math.min(pw, ph) * 0.6)
            const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 })
            createdGeos.push(geo)
            createdMats.push(mat)
            const cube = new THREE.Mesh(geo, mat)
            cube.userData.itemId = item.id
            modelGroup.add(cube)
            pickables.push(cube)
            scheduleRender()
          })
      } else if (item.type === 'image') {
        const geo = new THREE.PlaneGeometry(pw, ph)
        createdGeos.push(geo)
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: item.opacity,
          side: THREE.DoubleSide
        })
        createdMats.push(mat)
        const plane = new THREE.Mesh(geo, mat)
        plane.userData.itemId = item.id
        group.add(plane)
        pickables.push(plane)

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const tex = new THREE.Texture(img)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          createdTextures.push(tex)
          mat.map = tex
          mat.needsUpdate = true
          scheduleRender()
        }
        img.src = item.src
      } else {
        const geo = new THREE.PlaneGeometry(pw, ph)
        createdGeos.push(geo)
        const tex = makeCardTexture(item)
        createdTextures.push(tex)
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: item.opacity,
          side: THREE.DoubleSide
        })
        createdMats.push(mat)
        const plane = new THREE.Mesh(geo, mat)
        plane.userData.itemId = item.id
        group.add(plane)
        pickables.push(plane)
      }

      scene.add(group)
      meshMapRef.current.set(item.id, { group, baseZ })
    })

    // Place grid floor cleanly below the lowest card so it never slices through items
    const gridSize = Math.max(60, Math.ceil(Math.max(maxWorldX - minWorldX, 30) * 1.8))
    grid.position.y = minWorldY - 1.4
    grid.scale.setScalar(gridSize / 50)

    // Auto-fit camera to frame the entire 3D board cleanly
    const cx = (minWorldX + maxWorldX) / 2
    const cy = (minWorldY + maxWorldY) / 2
    const span = Math.max(maxWorldX - minWorldX, maxWorldY - minWorldY, 10)
    const camDist = span * 1.1
    const homePos = new THREE.Vector3(cx, cy + span * 0.12, camDist)
    const homeTarget = new THREE.Vector3(cx, cy, 0)
    homeViewRef.current = { pos: homePos, target: homeTarget }
    camera.position.copy(homePos)
    controls.target.copy(homeTarget)
    controls.update()

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
          onSelectRef.current(itemId)
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
      scheduleRender()
    })
    ro.observe(container)

    scheduleRender()

    return () => {
      ro.disconnect()
      controls.removeEventListener('change', scheduleRender)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, theme])

  // Update Z depth smoothly without rebuilding the WebGL scene
  useEffect(() => {
    meshMapRef.current.forEach(({ group, baseZ }) => {
      group.position.z = baseZ * depthSpread
    })
    requestRender()
  }, [depthSpread, requestRender])

  const focusOnSelected = (): void => {
    if (!focusedItem || !cameraRef.current || !controlsRef.current) return
    const entry = meshMapRef.current.get(focusedItem.id)
    if (!entry) return
    controlsRef.current.target.copy(entry.group.position)
    cameraRef.current.position.set(
      entry.group.position.x,
      entry.group.position.y + 0.6,
      entry.group.position.z + 6
    )
    controlsRef.current.update()
    requestRender()
  }

  const resetCamera = (): void => {
    if (!cameraRef.current || !controlsRef.current) return
    cameraRef.current.position.copy(homeViewRef.current.pos)
    controlsRef.current.target.copy(homeViewRef.current.target)
    controlsRef.current.update()
    requestRender()
  }

  return (
    <div className="workspace-3d-overlay">
      <div ref={mountRef} className="workspace-3d-canvas" />

      <div className="workspace-3d-hud">
        <div className="hud-pill">
          <Box size={14} color="#2563eb" />
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
            <div style={{ fontSize: 11, color: '#64748b' }}>Type: {focusedItem.type}</div>
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
