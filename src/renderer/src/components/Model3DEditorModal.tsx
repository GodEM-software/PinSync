import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { Box, Check, Download, Palette, Printer, Stamp, Type, X } from 'lucide-react'
import type { Model3DItem } from '../types/board'
import { centerAndScaleObject, loadModelObject as loadThreeObject } from '../items/Model3DItem'

interface Model3DEditorModalProps {
  item: Model3DItem | null // null = create new 3D primitive
  onClose: () => void
  onSaveGlbToBoard: (dataUrl: string, name: string, existingItemId?: string) => void
  onPrintSnapshotToBoard: (dataUrl: string, name: string) => void
}

type PrimitiveKind = 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone'

function makeTextDecalMesh(
  text: string,
  textColor: string,
  bgColor: string,
  transparentBg: boolean
): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const ctx = canvas.getContext('2d')!

  if (!transparentBg) {
    ctx.fillStyle = bgColor
    ctx.beginPath()
    ctx.roundRect(8, 8, 496, 176, 24)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 4
    ctx.stroke()
  }

  ctx.fillStyle = textColor
  ctx.font = '700 64px Inter, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.slice(0, 24), 256, 98, 460)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const geo = new THREE.PlaneGeometry(0.75, 0.28)
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `TextPrint_${text}`
  return mesh
}

export const Model3DEditorModal: React.FC<Model3DEditorModalProps> = ({
  item,
  onClose,
  onSaveGlbToBoard,
  onPrintSnapshotToBoard
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rootGroupRef = useRef<THREE.Group | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const selectedMeshRef = useRef<THREE.Mesh | null>(null)

  const [toolMode, setToolMode] = useState<'select' | 'stamp'>('select')
  const [selectedMeshName, setSelectedMeshName] = useState<string>('None (click model)')
  const [meshColor, setMeshColor] = useState('#38bdf8')
  const [roughness, setRoughness] = useState(0.45)
  const [metalness, setMetalness] = useState(0.2)

  const [printText, setPrintText] = useState('PinSync')
  const [textColor, setTextColor] = useState('#ffffff')
  const [badgeColor, setBadgeColor] = useState('#0f172a')
  const [transparentBadge, setTransparentBadge] = useState(false)
  const [primitive, setPrimitive] = useState<PrimitiveKind>('box')
  const [loading, setLoading] = useState(Boolean(item))

  const toolModeRef = useRef(toolMode)
  const printTextRef = useRef(printText)
  const textColorRef = useRef(textColor)
  const badgeColorRef = useRef(badgeColor)
  const transparentBadgeRef = useRef(transparentBadge)

  useEffect(() => {
    toolModeRef.current = toolMode
  }, [toolMode])
  useEffect(() => {
    printTextRef.current = printText
  }, [printText])
  useEffect(() => {
    textColorRef.current = textColor
  }, [textColor])
  useEffect(() => {
    badgeColorRef.current = badgeColor
  }, [badgeColor])
  useEffect(() => {
    transparentBadgeRef.current = transparentBadge
  }, [transparentBadge])

  const buildPrimitive = (kind: PrimitiveKind): THREE.Mesh => {
    const geos: Record<PrimitiveKind, THREE.BufferGeometry> = {
      box: new THREE.BoxGeometry(1.6, 1.6, 1.6),
      sphere: new THREE.SphereGeometry(1.05, 48, 32),
      cylinder: new THREE.CylinderGeometry(0.85, 0.85, 1.8, 40),
      torus: new THREE.TorusGeometry(0.85, 0.32, 24, 60),
      cone: new THREE.ConeGeometry(1.0, 1.9, 40)
    }
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.4,
      metalness: 0.2
    })
    const mesh = new THREE.Mesh(geos[kind], mat)
    mesh.name = `Primitive_${kind}`
    return mesh
  }

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111520)
    sceneRef.current = scene

    const w = container.clientWidth || 720
    const h = container.clientHeight || 520
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 200)
    camera.position.set(2.8, 2.1, 3.2)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3)
    keyLight.position.set(5, 8, 6)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.6)
    rimLight.position.set(-5, -3, -4)
    scene.add(rimLight)

    const grid = new THREE.GridHelper(10, 20, 0x3b82f6, 0x262e42)
    grid.position.y = -1.25
    scene.add(grid)

    const rootGroup = new THREE.Group()
    rootGroupRef.current = rootGroup
    scene.add(rootGroup)

    let cancelled = false
    if (item) {
      void loadThreeObject(item.src, item.format, renderer, item.filePath)
        .then((obj) => {
          if (cancelled) return
          centerAndScaleObject(obj)
          rootGroup.add(obj)
          setLoading(false)
        })
        .catch(() => {
          if (!cancelled) {
            rootGroup.add(buildPrimitive('box'))
            setLoading(false)
          }
        })
    } else {
      rootGroup.add(buildPrimitive(primitive))
    }

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

      const hits = raycaster.intersectObjects(rootGroup.children, true)
      if (hits.length === 0) return
      const hit = hits[0]

      if (toolModeRef.current === 'stamp') {
        const text = printTextRef.current.trim() || 'PinSync'
        const decal = makeTextDecalMesh(
          text,
          textColorRef.current,
          badgeColorRef.current,
          transparentBadgeRef.current
        )
        const normal = hit.face?.normal
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
          : new THREE.Vector3(0, 0, 1)
        decal.position.copy(hit.point).addScaledVector(normal, 0.015)
        const lookTarget = decal.position.clone().add(normal)
        decal.lookAt(lookTarget)
        rootGroup.add(decal)
        return
      }

      if ((hit.object as THREE.Mesh).isMesh) {
        const mesh = hit.object as THREE.Mesh
        selectedMeshRef.current = mesh
        setSelectedMeshName(mesh.name || 'Mesh Part')
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (mat && 'color' in mat && (mat as THREE.MeshStandardMaterial).color) {
          setMeshColor(`#${(mat as THREE.MeshStandardMaterial).color.getHexString()}`)
        }
        if (mat && 'roughness' in mat) {
          setRoughness((mat as THREE.MeshStandardMaterial).roughness)
        }
        if (mat && 'metalness' in mat) {
          setMetalness((mat as THREE.MeshStandardMaterial).metalness)
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth || 720
      const nh = container.clientHeight || 520
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
      cancelled = true
      cancelAnimationFrame(rafId)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [item, primitive])

  const applyColorToSelected = (hex: string, rough: number, metal: number): void => {
    const target = selectedMeshRef.current
    const apply = (mesh: THREE.Mesh): void => {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (mat && 'color' in mat) {
        const cloned = mat.clone() as THREE.MeshStandardMaterial
        cloned.color.set(hex)
        if ('roughness' in cloned) cloned.roughness = rough
        if ('metalness' in cloned) cloned.metalness = metal
        mesh.material = cloned
      }
    }
    if (target) {
      apply(target)
    } else if (rootGroupRef.current) {
      rootGroupRef.current.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && !c.name.startsWith('TextPrint_')) {
          apply(c as THREE.Mesh)
        }
      })
    }
  }

  const handleSaveGlb = (): void => {
    if (!rootGroupRef.current) return
    const exporter = new GLTFExporter()
    exporter.parse(
      rootGroupRef.current,
      (res) => {
        const blob =
          res instanceof ArrayBuffer
            ? new Blob([res], { type: 'model/gltf-binary' })
            : new Blob([JSON.stringify(res)], { type: 'model/gltf+json' })
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result || '')
          onSaveGlbToBoard(
            dataUrl,
            item ? `${item.name} (Edited)` : `3D_${primitive}.glb`,
            item?.id
          )
          onClose()
        }
        reader.readAsDataURL(blob)
      },
      () => {
        // ignore export error
      },
      { binary: true }
    )
  }

  const handlePrintRender = (): void => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    rendererRef.current.render(sceneRef.current, cameraRef.current)
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png')
    onPrintSnapshotToBoard(dataUrl, item ? `${item.name} Print` : `3D ${primitive} Print`)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          width: 'min(1080px, 94vw)',
          height: 'min(700px, 88vh)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Box size={16} color="#38bdf8" />
            <span>Three.js 3D Editor — Color, Text &amp; Print</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-secondary small"
              onClick={handlePrintRender}
              title="Render & Print Image to Board"
            >
              <Printer size={13} /> Print Snapshot
            </button>
            <button className="btn-primary small" onClick={handleSaveGlb}>
              <Check size={13} /> Save 3D to Board
            </button>
            <button className="win-btn tiny" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* 3D Viewport */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            {loading && <div className="model3d-overlay-msg">Loading 3D model into editor…</div>}
            <div className="editor3d-hint">
              {toolMode === 'stamp'
                ? 'Click anywhere on the 3D model surface to print/stamp text'
                : 'Click any part of the 3D model to select & paint · Drag to orbit'}
            </div>
          </div>

          {/* Right Inspector */}
          <aside className="editor3d-sidebar">
            {!item && (
              <div className="editor3d-section">
                <div className="ctx-section-label">3D Primitive Shape</div>
                <div className="fp-shape-grid">
                  {(['box', 'sphere', 'cylinder', 'torus', 'cone'] as PrimitiveKind[]).map((p) => (
                    <button
                      key={p}
                      className={`fp-pill ${primitive === p ? 'active' : ''}`}
                      onClick={() => setPrimitive(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="editor3d-section">
              <div className="ctx-section-label">Click Mode</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className={`fp-pill ${toolMode === 'select' ? 'active' : ''}`}
                  onClick={() => setToolMode('select')}
                >
                  <Palette size={12} /> Select &amp; Color
                </button>
                <button
                  className={`fp-pill ${toolMode === 'stamp' ? 'active' : ''}`}
                  onClick={() => setToolMode('stamp')}
                >
                  <Stamp size={12} /> Print Text
                </button>
              </div>
            </div>

            <div className="editor3d-section">
              <div className="ctx-section-label">Material &amp; Color</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                Selected: <strong style={{ color: '#e2e8f0' }}>{selectedMeshName}</strong>
              </div>
              <div className="fp-row">
                <span>Color</span>
                <div className="fp-swatches">
                  {['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#f8fafc', '#1e293b'].map((c) => (
                    <button
                      key={c}
                      className={`fp-swatch ${meshColor === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => {
                        setMeshColor(c)
                        applyColorToSelected(c, roughness, metalness)
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    className="fp-color-input"
                    value={meshColor}
                    onChange={(e) => {
                      setMeshColor(e.target.value)
                      applyColorToSelected(e.target.value, roughness, metalness)
                    }}
                  />
                </div>
              </div>
              <div className="fp-row">
                <span>Roughness</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={roughness}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setRoughness(v)
                    applyColorToSelected(meshColor, v, metalness)
                  }}
                />
                <span className="fp-val">{roughness.toFixed(2)}</span>
              </div>
              <div className="fp-row">
                <span>Metalness</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={metalness}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setMetalness(v)
                    applyColorToSelected(meshColor, roughness, v)
                  }}
                />
                <span className="fp-val">{metalness.toFixed(2)}</span>
              </div>
            </div>

            <div className="editor3d-section">
              <div className="ctx-section-label">
                <Type size={11} /> Add Text &amp; Print on 3D
              </div>
              <input
                className="fp-input"
                style={{ width: '100%', marginBottom: 8 }}
                value={printText}
                onChange={(e) => setPrintText(e.target.value)}
                placeholder="Text to print on 3D..."
              />
              <div className="fp-row">
                <span>Text Color</span>
                <input
                  type="color"
                  className="fp-color-input"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
                <span>Badge</span>
                <input
                  type="color"
                  className="fp-color-input"
                  value={badgeColor}
                  onChange={(e) => setBadgeColor(e.target.value)}
                />
              </div>
              <label className="toggle-pill" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={transparentBadge}
                  onChange={(e) => setTransparentBadge(e.target.checked)}
                />
                <span>Transparent text background</span>
              </label>
              <button
                className="btn-primary small"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setToolMode('stamp')}
              >
                <Stamp size={12} /> Click Model to Print Text
              </button>
            </div>

            <div className="editor3d-section" style={{ marginTop: 'auto' }}>
              <button
                className="btn-secondary small"
                style={{ width: '100%' }}
                onClick={() => window.print()}
              >
                <Download size={12} /> System Print / PDF
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
