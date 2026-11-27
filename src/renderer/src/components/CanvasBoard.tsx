import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardItem, BoardTheme, CropRect, ViewportState } from '../types/board'
import {
  aabbIntersects,
  clampZoom,
  computeSnapAndGuides,
  degToRad,
  getItemWorldAABB,
  radToDeg,
  screenToWorld,
  type AlignmentGuide
} from '../utils/boardMath'
import { BoardItemWrapper } from './BoardItemWrapper'
import { TransformGizmo, type HandleDir } from './TransformGizmo'

export interface ArrowDraft {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface CanvasBoardProps {
  items: BoardItem[]
  selectedIds: string[]
  interactiveItemId: string | null
  viewport: ViewportState
  canvasLocked: boolean
  showGrid: boolean
  snapToGrid: boolean
  smartGuides: boolean
  theme: BoardTheme
  arrowToolActive: boolean
  arrowDraft: ArrowDraft | null
  drawToolActive: boolean
  penColor: string
  penWidth: number
  penOpacity: number
  onArrowDraftChange: (draft: ArrowDraft | null) => void
  onCommitArrow: (x1: number, y1: number, x2: number, y2: number) => void
  onStartArrowFromPort: (worldX: number, worldY: number) => void
  onCancelArrowTool: () => void
  onCommitDrawing: (
    points: Array<{ x: number; y: number }>,
    color: string,
    strokeWidth: number,
    opacity: number
  ) => void
  onCancelDrawTool: () => void
  onDirectCanvasType: (char: string, worldX: number, worldY: number) => void
  onTriggerArrowFromText: (item: BoardItem) => void
  onCursorWorldMove: (pt: { x: number; y: number }) => void
  onViewportChange: React.Dispatch<React.SetStateAction<ViewportState>>
  onSelectionChange: (ids: string[]) => void
  onInteractiveChange: (id: string | null) => void
  onItemsTransient: (updater: (prev: BoardItem[]) => BoardItem[]) => void
  onItemsCommit: (updater: (prev: BoardItem[]) => BoardItem[]) => void
  onSnapshotBeforeDrag: (snapshot: BoardItem[]) => void
  onDropFilesAndData: (dataTransfer: DataTransfer, worldX: number, worldY: number) => void
  onNativeDragOut: (item: BoardItem) => void
  onOpenContextMenu: (
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number,
    itemId: string | null
  ) => void
}

type InteractionState =
  | { mode: 'idle' }
  | { mode: 'pan'; startX: number; startY: number; startPanX: number; startPanY: number }
  | {
      mode: 'windowDrag'
      startX: number
      startY: number
      moved: boolean
      targetItemId: string | null
    }
  | {
      mode: 'marquee'
      startWorldX: number
      startWorldY: number
      curWorldX: number
      curWorldY: number
      additive: boolean
    }
  | {
      mode: 'moveItems'
      primaryId: string
      startWorldX: number
      startWorldY: number
      origins: Map<string, { x: number; y: number }>
      snapshot: BoardItem[]
    }
  | {
      mode: 'rotateItem'
      itemId: string
      startAngle: number
      startRotation: number
      snapshot: BoardItem[]
    }
  | {
      mode: 'scaleShortcut'
      itemId: string
      startScreenX: number
      startW: number
      startH: number
      snapshot: BoardItem[]
    }
  | {
      mode: 'resizeHandle'
      itemId: string
      dir: HandleDir
      startWorldX: number
      startWorldY: number
      startX: number
      startY: number
      startW: number
      startH: number
      rotation: number
      snapshot: BoardItem[]
    }
  | {
      mode: 'cropImage'
      itemId: string
      startLocalX: number
      startLocalY: number
      draft: CropRect
      snapshot: BoardItem[]
    }
  | {
      mode: 'drawStroke'
      points: Array<{ x: number; y: number }>
    }

const HANDLE_VECTORS: Record<HandleDir, { hx: number; hy: number }> = {
  nw: { hx: -1, hy: -1 },
  n: { hx: 0, hy: -1 },
  ne: { hx: 1, hy: -1 },
  e: { hx: 1, hy: 0 },
  se: { hx: 1, hy: 1 },
  s: { hx: 0, hy: 1 },
  sw: { hx: -1, hy: 1 },
  w: { hx: -1, hy: 0 }
}

function snapToNodeAnchor(
  pt: { x: number; y: number },
  items: BoardItem[],
  threshold = 18
): { x: number; y: number } {
  let best = pt
  let bestDist = threshold
  for (const it of items) {
    if (it.type !== 'flowchart' && it.type !== 'text') continue
    const anchors = [
      { x: it.x, y: it.y - it.height / 2 },
      { x: it.x + it.width / 2, y: it.y },
      { x: it.x, y: it.y + it.height / 2 },
      { x: it.x - it.width / 2, y: it.y }
    ]
    for (const a of anchors) {
      const d = Math.hypot(a.x - pt.x, a.y - pt.y)
      if (d < bestDist) {
        bestDist = d
        best = a
      }
    }
  }
  return best
}

function expandSelectionWithGroups(ids: string[], allItems: BoardItem[]): string[] {
  const groupIds = new Set<string>()
  for (const it of allItems) {
    if (ids.includes(it.id) && it.groupId) {
      groupIds.add(it.groupId)
    }
  }
  if (groupIds.size === 0) return ids
  const out = new Set(ids)
  for (const it of allItems) {
    if (it.groupId && groupIds.has(it.groupId)) {
      out.add(it.id)
    }
  }
  return Array.from(out)
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({
  items,
  selectedIds,
  interactiveItemId,
  viewport,
  canvasLocked,
  showGrid,
  snapToGrid,
  smartGuides,
  theme,
  arrowToolActive,
  arrowDraft,
  drawToolActive,
  penColor,
  penWidth,
  penOpacity,
  onArrowDraftChange,
  onCommitArrow,
  onStartArrowFromPort,
  onCancelArrowTool,
  onCommitDrawing,
  onCancelDrawTool,
  onDirectCanvasType,
  onTriggerArrowFromText,
  onCursorWorldMove,
  onViewportChange,
  onSelectionChange,
  onInteractiveChange,
  onItemsTransient,
  onItemsCommit,
  onSnapshotBeforeDrag,
  onDropFilesAndData,
  onNativeDragOut,
  onOpenContextMenu
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<InteractionState>({ mode: 'idle' })
  const dragDepthRef = useRef(0)
  const [spaceDown, setSpaceDown] = useState(false)
  const [altCropDown, setAltCropDown] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([])
  const [marqueeRect, setMarqueeRect] = useState<{
    minX: number
    minY: number
    width: number
    height: number
  } | null>(null)
  const [cropDraftState, setCropDraftState] = useState<{
    itemId: string
    draft: CropRect
  } | null>(null)
  const [drawPreviewPoints, setDrawPreviewPoints] = useState<Array<{
    x: number
    y: number
  }> | null>(null)

  const viewportRef = useRef(viewport)
  const itemsRef = useRef(items)
  const selectedIdsRef = useRef(selectedIds)
  const arrowDraftRef = useRef(arrowDraft)
  const arrowToolActiveRef = useRef(arrowToolActive)
  const drawToolActiveRef = useRef(drawToolActive)
  const penColorRef = useRef(penColor)
  const penWidthRef = useRef(penWidth)
  const penOpacityRef = useRef(penOpacity)
  const snapToGridRef = useRef(snapToGrid)
  const smartGuidesRef = useRef(smartGuides)
  const lastCursorWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    arrowDraftRef.current = arrowDraft
  }, [arrowDraft])

  useEffect(() => {
    arrowToolActiveRef.current = arrowToolActive
  }, [arrowToolActive])

  useEffect(() => {
    drawToolActiveRef.current = drawToolActive
  }, [drawToolActive])

  useEffect(() => {
    penColorRef.current = penColor
  }, [penColor])

  useEffect(() => {
    penWidthRef.current = penWidth
  }, [penWidth])

  useEffect(() => {
    penOpacityRef.current = penOpacity
  }, [penOpacity])

  useEffect(() => {
    snapToGridRef.current = snapToGrid
  }, [snapToGrid])

  useEffect(() => {
    smartGuidesRef.current = smartGuides
  }, [smartGuides])

  const getLocalCoords = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    return {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0)
    }
  }, [])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag.toLowerCase() === 'webview' ||
        target.isContentEditable
      )
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return
      if (e.code === 'Space') setSpaceDown(true)
      if (e.altKey && e.shiftKey) setAltCropDown(true)

      if (e.key === 'Escape') {
        if (drawToolActiveRef.current) {
          onCancelDrawTool()
          return
        }
        if (arrowDraftRef.current || arrowToolActiveRef.current) {
          onCancelArrowTool()
          return
        }
        if (interactiveItemId) {
          onInteractiveChange(null)
          return
        }
      }

      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !interactiveItemId &&
        !arrowToolActiveRef.current &&
        !arrowDraftRef.current &&
        !drawToolActiveRef.current &&
        e.key.length === 1 &&
        e.key !== ' ' &&
        e.key !== '[' &&
        e.key !== ']' &&
        e.key !== '?'
      ) {
        e.preventDefault()
        onDirectCanvasType(e.key, lastCursorWorldRef.current.x, lastCursorWorldRef.current.y)
      }
    }

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpaceDown(false)
      if (!e.altKey || !e.shiftKey) setAltCropDown(false)
    }

    const onBlur = (): void => {
      setSpaceDown(false)
      setAltCropDown(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [
    interactiveItemId,
    onCancelArrowTool,
    onCancelDrawTool,
    onDirectCanvasType,
    onInteractiveChange
  ])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (canvasLocked) return
      if (interactiveItemId) {
        const active = itemsRef.current.find((it) => it.id === interactiveItemId)
        if (
          active &&
          (active.type === 'webpage' || active.type === 'code' || active.type === 'model3d')
        ) {
          return
        }
      }

      e.preventDefault()
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const factor = Math.exp(-e.deltaY * 0.0014)

      onViewportChange((vp) => {
        const nextZoom = clampZoom(vp.zoom * factor)
        const scale = nextZoom / vp.zoom
        return {
          zoom: nextZoom,
          panX: screenPt.x - (screenPt.x - vp.panX) * scale,
          panY: screenPt.y - (screenPt.y - vp.panY) * scale
        }
      })
    },
    [canvasLocked, getLocalCoords, interactiveItemId, onViewportChange]
  )

  const startPan = useCallback((clientX: number, clientY: number) => {
    const vp = viewportRef.current
    interactionRef.current = {
      mode: 'pan',
      startX: clientX,
      startY: clientY,
      startPanX: vp.panX,
      startPanY: vp.panY
    }
  }, [])

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      lastCursorWorldRef.current = worldPt

      if (e.button === 1 || (e.button === 0 && (e.altKey || spaceDown))) {
        if (canvasLocked) return
        e.preventDefault()
        startPan(e.clientX, e.clientY)
        return
      }

      if (e.button === 2) {
        e.preventDefault()
        if (arrowDraftRef.current || arrowToolActiveRef.current) {
          onCancelArrowTool()
          return
        }
        window.api.startWindowDrag()
        interactionRef.current = {
          mode: 'windowDrag',
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          targetItemId: null
        }
        return
      }

      if (e.button === 0) {
        if (drawToolActiveRef.current) {
          e.preventDefault()
          const pts = [{ x: worldPt.x, y: worldPt.y }]
          setDrawPreviewPoints(pts)
          interactionRef.current = { mode: 'drawStroke', points: pts }
          return
        }
        if (arrowDraftRef.current) {
          e.preventDefault()
          const snapped = snapToNodeAnchor(worldPt, itemsRef.current)
          onCommitArrow(
            arrowDraftRef.current.startX,
            arrowDraftRef.current.startY,
            snapped.x,
            snapped.y
          )
          return
        }

        if (arrowToolActiveRef.current) {
          e.preventDefault()
          const snapped = snapToNodeAnchor(worldPt, itemsRef.current)
          onArrowDraftChange({
            startX: snapped.x,
            startY: snapped.y,
            endX: snapped.x,
            endY: snapped.y
          })
          return
        }

        if (interactiveItemId) {
          onInteractiveChange(null)
        }
        const additive = e.shiftKey || e.ctrlKey || e.metaKey
        if (!additive) {
          onSelectionChange([])
        }
        interactionRef.current = {
          mode: 'marquee',
          startWorldX: worldPt.x,
          startWorldY: worldPt.y,
          curWorldX: worldPt.x,
          curWorldY: worldPt.y,
          additive
        }
      }
    },
    [
      canvasLocked,
      getLocalCoords,
      interactiveItemId,
      onArrowDraftChange,
      onCancelArrowTool,
      onCommitArrow,
      onInteractiveChange,
      onSelectionChange,
      spaceDown,
      startPan
    ]
  )

  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, item: BoardItem) => {
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      lastCursorWorldRef.current = worldPt

      if (
        e.button === 1 ||
        (e.button === 0 && e.altKey && !e.ctrlKey && !e.shiftKey) ||
        (e.button === 0 && spaceDown)
      ) {
        if (canvasLocked) return
        e.stopPropagation()
        e.preventDefault()
        startPan(e.clientX, e.clientY)
        return
      }

      if (e.button === 0 && drawToolActiveRef.current) {
        e.stopPropagation()
        e.preventDefault()
        const pts = [{ x: worldPt.x, y: worldPt.y }]
        setDrawPreviewPoints(pts)
        interactionRef.current = { mode: 'drawStroke', points: pts }
        return
      }

      if (e.button === 0 && (arrowDraftRef.current || arrowToolActiveRef.current)) {
        e.stopPropagation()
        e.preventDefault()
        const snapped = snapToNodeAnchor(worldPt, itemsRef.current)
        if (arrowDraftRef.current) {
          onCommitArrow(
            arrowDraftRef.current.startX,
            arrowDraftRef.current.startY,
            snapped.x,
            snapped.y
          )
        } else {
          onArrowDraftChange({
            startX: snapped.x,
            startY: snapped.y,
            endX: snapped.x,
            endY: snapped.y
          })
        }
        return
      }

      if (e.button === 2) {
        e.stopPropagation()
        e.preventDefault()
        if (!selectedIdsRef.current.includes(item.id)) {
          onSelectionChange(expandSelectionWithGroups([item.id], itemsRef.current))
        }
        window.api.startWindowDrag()
        interactionRef.current = {
          mode: 'windowDrag',
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          targetItemId: item.id
        }
        return
      }

      if (e.button !== 0) return
      e.stopPropagation()

      if (interactiveItemId && interactiveItemId !== item.id) {
        onInteractiveChange(null)
      }

      if (interactiveItemId === item.id) {
        return
      }

      let nextSelection = selectedIdsRef.current
      if (e.shiftKey && !e.ctrlKey) {
        nextSelection = selectedIdsRef.current.includes(item.id)
          ? selectedIdsRef.current.filter((id) => id !== item.id)
          : expandSelectionWithGroups([...selectedIdsRef.current, item.id], itemsRef.current)
        onSelectionChange(nextSelection)
      } else if (!selectedIdsRef.current.includes(item.id)) {
        nextSelection = expandSelectionWithGroups([item.id], itemsRef.current)
        onSelectionChange(nextSelection)
      }

      if (canvasLocked || item.locked) return

      const snapshot = itemsRef.current

      if (e.altKey && e.shiftKey && item.type === 'image') {
        const dx = worldPt.x - item.x
        const dy = worldPt.y - item.y
        const rad = degToRad(-item.rotation)
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
        const nx = Math.min(1, Math.max(0, lx / item.width + 0.5))
        const ny = Math.min(1, Math.max(0, ly / item.height + 0.5))
        const draft: CropRect = { left: nx, top: ny, right: 1 - nx, bottom: 1 - ny }
        setCropDraftState({ itemId: item.id, draft })
        interactionRef.current = {
          mode: 'cropImage',
          itemId: item.id,
          startLocalX: nx,
          startLocalY: ny,
          draft,
          snapshot
        }
        return
      }

      if (e.ctrlKey && e.altKey) {
        interactionRef.current = {
          mode: 'scaleShortcut',
          itemId: item.id,
          startScreenX: e.clientX,
          startW: item.width,
          startH: item.height,
          snapshot
        }
        return
      }

      if (e.ctrlKey) {
        const startAngle = radToDeg(Math.atan2(worldPt.y - item.y, worldPt.x - item.x))
        interactionRef.current = {
          mode: 'rotateItem',
          itemId: item.id,
          startAngle,
          startRotation: item.rotation,
          snapshot
        }
        return
      }

      const origins = new Map<string, { x: number; y: number }>()
      for (const it of itemsRef.current) {
        if (nextSelection.includes(it.id) && !it.locked) {
          origins.set(it.id, { x: it.x, y: it.y })
        }
      }
      interactionRef.current = {
        mode: 'moveItems',
        primaryId: item.id,
        startWorldX: worldPt.x,
        startWorldY: worldPt.y,
        origins,
        snapshot
      }
    },
    [
      canvasLocked,
      getLocalCoords,
      interactiveItemId,
      onArrowDraftChange,
      onCommitArrow,
      onInteractiveChange,
      onSelectionChange,
      spaceDown,
      startPan
    ]
  )

  const handleStartResize = useCallback(
    (e: React.MouseEvent, item: BoardItem, dir: HandleDir) => {
      if (canvasLocked || item.locked) return
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      interactionRef.current = {
        mode: 'resizeHandle',
        itemId: item.id,
        dir,
        startWorldX: worldPt.x,
        startWorldY: worldPt.y,
        startX: item.x,
        startY: item.y,
        startW: item.width,
        startH: item.height,
        rotation: item.rotation,
        snapshot: itemsRef.current
      }
    },
    [canvasLocked, getLocalCoords]
  )

  const handleStartRotate = useCallback(
    (e: React.MouseEvent, item: BoardItem) => {
      if (canvasLocked || item.locked) return
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      const startAngle = radToDeg(Math.atan2(worldPt.y - item.y, worldPt.x - item.x))
      interactionRef.current = {
        mode: 'rotateItem',
        itemId: item.id,
        startAngle,
        startRotation: item.rotation,
        snapshot: itemsRef.current
      }
    },
    [canvasLocked, getLocalCoords]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      lastCursorWorldRef.current = worldPt
      onCursorWorldMove(worldPt)

      if (arrowDraftRef.current) {
        const snapped = snapToNodeAnchor(worldPt, itemsRef.current)
        onArrowDraftChange({
          ...arrowDraftRef.current,
          endX: snapped.x,
          endY: snapped.y
        })
      }

      const state = interactionRef.current
      if (state.mode === 'idle') return

      if (state.mode === 'drawStroke') {
        const last = state.points[state.points.length - 1]
        const minStep = 2 / viewportRef.current.zoom
        if (!last || Math.hypot(worldPt.x - last.x, worldPt.y - last.y) >= minStep) {
          state.points.push({ x: worldPt.x, y: worldPt.y })
          setDrawPreviewPoints([...state.points])
        }
        return
      }

      if (state.mode === 'pan') {
        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY
        onViewportChange((vp) => ({
          ...vp,
          panX: state.startPanX + dx,
          panY: state.startPanY + dy
        }))
        return
      }

      if (state.mode === 'windowDrag') {
        const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY)
        if (dist > 5) {
          state.moved = true
        }
        if (state.moved) {
          window.api.moveWindowDrag()
        }
        return
      }

      if (state.mode === 'marquee') {
        state.curWorldX = worldPt.x
        state.curWorldY = worldPt.y
        const minX = Math.min(state.startWorldX, state.curWorldX)
        const minY = Math.min(state.startWorldY, state.curWorldY)
        const maxX = Math.max(state.startWorldX, state.curWorldX)
        const maxY = Math.max(state.startWorldY, state.curWorldY)
        setMarqueeRect({ minX, minY, width: maxX - minX, height: maxY - minY })

        const box = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
        const hitIds = itemsRef.current
          .filter((it) => aabbIntersects(box, getItemWorldAABB(it)))
          .map((it) => it.id)
        const expanded = expandSelectionWithGroups(hitIds, itemsRef.current)
        if (state.additive) {
          const merged = Array.from(new Set([...selectedIdsRef.current, ...expanded]))
          onSelectionChange(merged)
        } else {
          onSelectionChange(expanded)
        }
        return
      }

      if (state.mode === 'moveItems') {
        // If user holds & drags an item outside the window edge, trigger native OS file drag-out
        if (
          e.clientX <= 4 ||
          e.clientY <= 4 ||
          e.clientX >= window.innerWidth - 4 ||
          e.clientY >= window.innerHeight - 4
        ) {
          const primary = itemsRef.current.find((it) => it.id === state.primaryId)
          if (primary) {
            onItemsTransient(() => state.snapshot)
            setActiveGuides([])
            interactionRef.current = { mode: 'idle' }
            onNativeDragOut(primary)
            return
          }
        }

        let dx = worldPt.x - state.startWorldX
        let dy = worldPt.y - state.startWorldY

        const primary = itemsRef.current.find((it) => it.id === state.primaryId)
        const primaryOrig = state.origins.get(state.primaryId)
        if (primary && primaryOrig && (snapToGridRef.current || smartGuidesRef.current)) {
          const movingSet = new Set(state.origins.keys())
          const snapRes = computeSnapAndGuides(
            primary,
            primaryOrig.x + dx,
            primaryOrig.y + dy,
            itemsRef.current,
            movingSet,
            snapToGridRef.current,
            smartGuidesRef.current
          )
          dx = snapRes.x - primaryOrig.x
          dy = snapRes.y - primaryOrig.y
          setActiveGuides(snapRes.guides)
        } else {
          setActiveGuides([])
        }

        onItemsTransient((prev) =>
          prev.map((it) => {
            const orig = state.origins.get(it.id)
            if (!orig) return it
            return { ...it, x: orig.x + dx, y: orig.y + dy }
          })
        )
        return
      }

      if (state.mode === 'rotateItem') {
        const target = itemsRef.current.find((it) => it.id === state.itemId)
        if (!target) return
        const curAngle = radToDeg(Math.atan2(worldPt.y - target.y, worldPt.x - target.x))
        let nextRot = state.startRotation + (curAngle - state.startAngle)
        if (e.shiftKey) {
          nextRot = Math.round(nextRot / 15) * 15
        }
        onItemsTransient((prev) =>
          prev.map((it) => (it.id === state.itemId ? { ...it, rotation: nextRot } : it))
        )
        return
      }

      if (state.mode === 'scaleShortcut') {
        const dx = e.clientX - state.startScreenX
        const factor = Math.max(0.15, Math.exp(dx * 0.006))
        const nextW = Math.max(48, Math.round(state.startW * factor))
        const nextH = Math.max(48, Math.round(state.startH * factor))
        onItemsTransient((prev) =>
          prev.map((it) => (it.id === state.itemId ? { ...it, width: nextW, height: nextH } : it))
        )
        return
      }

      if (state.mode === 'resizeHandle') {
        const { hx, hy } = HANDLE_VECTORS[state.dir]
        const rad = degToRad(state.rotation)
        const ux = { x: Math.cos(rad), y: Math.sin(rad) }
        const uy = { x: -Math.sin(rad), y: Math.cos(rad) }

        const dxW = worldPt.x - state.startWorldX
        const dyW = worldPt.y - state.startWorldY

        const dLocalX = dxW * ux.x + dyW * ux.y
        const dLocalY = dxW * uy.x + dyW * uy.y

        const fromCenter = e.altKey
        const mul = fromCenter ? 2 : 1
        const rawDw = hx * dLocalX * mul
        const rawDh = hy * dLocalY * mul

        let newW = hx !== 0 ? Math.max(48, state.startW + rawDw) : state.startW
        let newH = hy !== 0 ? Math.max(48, state.startH + rawDh) : state.startH

        if (hx !== 0 && hy !== 0 && !e.shiftKey) {
          const s = Math.max(
            (state.startW + rawDw) / state.startW,
            (state.startH + rawDh) / state.startH,
            48 / Math.min(state.startW, state.startH)
          )
          newW = Math.max(48, state.startW * s)
          newH = Math.max(48, state.startH * s)
        }

        let newCx = state.startX
        let newCy = state.startY
        if (!fromCenter) {
          const actualDw = newW - state.startW
          const actualDh = newH - state.startH
          const shiftLX = (hx * actualDw) / 2
          const shiftLY = (hy * actualDh) / 2
          newCx += shiftLX * ux.x + shiftLY * uy.x
          newCy += shiftLX * ux.y + shiftLY * uy.y
        }

        onItemsTransient((prev) =>
          prev.map((it) =>
            it.id === state.itemId ? { ...it, x: newCx, y: newCy, width: newW, height: newH } : it
          )
        )
        return
      }

      if (state.mode === 'cropImage') {
        const target = itemsRef.current.find((it) => it.id === state.itemId)
        if (!target) return
        const dx = worldPt.x - target.x
        const dy = worldPt.y - target.y
        const rad = degToRad(-target.rotation)
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
        const nx = Math.min(1, Math.max(0, lx / target.width + 0.5))
        const ny = Math.min(1, Math.max(0, ly / target.height + 0.5))
        const x1 = Math.min(state.startLocalX, nx)
        const x2 = Math.max(state.startLocalX, nx)
        const y1 = Math.min(state.startLocalY, ny)
        const y2 = Math.max(state.startLocalY, ny)
        const draft: CropRect = {
          left: x1,
          top: y1,
          right: Math.max(0, 1 - x2),
          bottom: Math.max(0, 1 - y2)
        }
        state.draft = draft
        setCropDraftState({ itemId: state.itemId, draft })
      }
    }

    const onMouseUp = (e: MouseEvent): void => {
      const state = interactionRef.current
      if (state.mode === 'idle') return

      setActiveGuides([])

      if (state.mode === 'drawStroke') {
        setDrawPreviewPoints(null)
        if (state.points.length >= 1) {
          onCommitDrawing(
            state.points,
            penColorRef.current,
            penWidthRef.current,
            penOpacityRef.current
          )
        }
      } else if (state.mode === 'windowDrag') {
        window.api.endWindowDrag()
        if (!state.moved) {
          const screenPt = getLocalCoords(e.clientX, e.clientY)
          const worldPt = screenToWorld(screenPt, viewportRef.current)
          onOpenContextMenu(e.clientX, e.clientY, worldPt.x, worldPt.y, state.targetItemId)
        }
      } else if (state.mode === 'marquee') {
        setMarqueeRect(null)
      } else if (
        state.mode === 'moveItems' ||
        state.mode === 'rotateItem' ||
        state.mode === 'scaleShortcut' ||
        state.mode === 'resizeHandle'
      ) {
        if (state.snapshot !== itemsRef.current) {
          onSnapshotBeforeDrag(state.snapshot)
        }
      } else if (state.mode === 'cropImage') {
        setCropDraftState(null)
        const wSpan = 1 - state.draft.left - state.draft.right
        const hSpan = 1 - state.draft.top - state.draft.bottom
        if (wSpan > 0.04 && hSpan > 0.04) {
          onItemsCommit((prev) =>
            prev.map((it) =>
              it.id === state.itemId && it.type === 'image' ? { ...it, crop: state.draft } : it
            )
          )
        }
      }

      interactionRef.current = { mode: 'idle' }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [
    getLocalCoords,
    onArrowDraftChange,
    onCommitDrawing,
    onCursorWorldMove,
    onItemsCommit,
    onItemsTransient,
    onNativeDragOut,
    onOpenContextMenu,
    onSelectionChange,
    onSnapshotBeforeDrag,
    onViewportChange
  ])

  const handleItemDoubleClick = useCallback(
    (e: React.MouseEvent, item: BoardItem) => {
      e.stopPropagation()
      if (
        item.type === 'webpage' ||
        item.type === 'model3d' ||
        item.type === 'video' ||
        item.type === 'text' ||
        item.type === 'flowchart' ||
        item.type === 'code'
      ) {
        onInteractiveChange(interactiveItemId === item.id ? null : item.id)
      }
    },
    [interactiveItemId, onInteractiveChange]
  )

  const handleItemUpdate = useCallback(
    (id: string, patch: Partial<BoardItem>) => {
      onItemsTransient((prev) =>
        prev.map((it) => (it.id === id ? ({ ...it, ...patch } as BoardItem) : it))
      )
    },
    [onItemsTransient]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragDepthRef.current += 1
    if (dragDepthRef.current === 1) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragDepthRef.current = 0
      setIsDragOver(false)
      const screenPt = getLocalCoords(e.clientX, e.clientY)
      const worldPt = screenToWorld(screenPt, viewportRef.current)
      onDropFilesAndData(e.dataTransfer, worldPt.x, worldPt.y)
    },
    [getLocalCoords, onDropFilesAndData]
  )

  const cursorClass =
    arrowToolActive || arrowDraft || drawToolActive
      ? 'cursor-crosshair'
      : spaceDown
        ? 'cursor-grab'
        : altCropDown
          ? 'cursor-crop'
          : ''

  const selectedItems = items.filter((it) => selectedIds.includes(it.id))

  return (
    <div
      ref={containerRef}
      className={`canvas-board theme-${theme} ${showGrid ? 'with-grid' : ''} ${cursorClass} ${isDragOver ? 'drag-over' : ''}`}
      style={
        showGrid
          ? theme === 'blueprint'
            ? {
                backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
                backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`
              }
            : {
                backgroundPosition: `${viewport.panX}px ${viewport.panY}px, 0 0`,
                backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px, 100% 100%`
              }
          : undefined
      }
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="canvas-world"
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`
        }}
      >
        {items.map((item) => (
          <BoardItemWrapper
            key={item.id}
            item={item}
            isSelected={selectedIds.includes(item.id)}
            isInteractive={interactiveItemId === item.id}
            cropDraft={cropDraftState?.itemId === item.id ? cropDraftState.draft : null}
            onMouseDown={handleItemMouseDown}
            onDoubleClick={handleItemDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
            onUpdate={handleItemUpdate}
            onRequestInteract={(id) => onInteractiveChange(interactiveItemId === id ? null : id)}
            onFinishInteract={() => onInteractiveChange(null)}
            onTriggerArrowFromText={onTriggerArrowFromText}
            onStartArrowFromPort={onStartArrowFromPort}
          />
        ))}

        {activeGuides.map((g, idx) =>
          g.orientation === 'v' ? (
            <div key={`gv_${idx}`} className="align-guide align-guide-v" style={{ left: g.pos }} />
          ) : (
            <div key={`gh_${idx}`} className="align-guide align-guide-h" style={{ top: g.pos }} />
          )
        )}

        {arrowDraft && (
          <svg
            className="arrow-preview-svg"
            style={{
              left: 0,
              top: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              position: 'absolute',
              zIndex: 100001
            }}
            width={1}
            height={1}
          >
            <defs>
              <marker
                id="arrow-draft-head"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#60a5fa" />
              </marker>
            </defs>
            <line
              x1={arrowDraft.startX}
              y1={arrowDraft.startY}
              x2={arrowDraft.endX}
              y2={arrowDraft.endY}
              stroke="#60a5fa"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              markerEnd="url(#arrow-draft-head)"
            />
          </svg>
        )}

        {drawPreviewPoints && drawPreviewPoints.length > 0 && (
          <svg
            style={{
              left: 0,
              top: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              position: 'absolute',
              zIndex: 100001
            }}
            width={1}
            height={1}
          >
            <path
              d={
                drawPreviewPoints.length === 1
                  ? `M ${drawPreviewPoints[0].x} ${drawPreviewPoints[0].y} L ${drawPreviewPoints[0].x + 0.5} ${drawPreviewPoints[0].y}`
                  : drawPreviewPoints
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                      .join(' ')
              }
              fill="none"
              stroke={penColor}
              strokeWidth={penWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={penOpacity}
            />
          </svg>
        )}

        {selectedItems.map((item) => (
          <TransformGizmo
            key={`gizmo_${item.id}`}
            item={item}
            zoom={viewport.zoom}
            onStartResize={handleStartResize}
            onStartRotate={handleStartRotate}
          />
        ))}

        {marqueeRect && (
          <div
            className="marquee-box"
            style={{
              left: marqueeRect.minX,
              top: marqueeRect.minY,
              width: marqueeRect.width,
              height: marqueeRect.height
            }}
          />
        )}
      </div>

      {items.length === 0 && !arrowToolActive && !arrowDraft && !drawToolActive && (
        <div className="empty-board-hint">
          <div className="empty-title">Type anywhere or drop reference material</div>
          <div className="empty-sub">
            Images · Videos · Webpages · Sound · 3D Models · Code · Drawings &amp; Flowcharts
          </div>
          <div className="empty-controls">
            <span>Type directly: Text</span>
            <span>Alt+D: Free Draw</span>
            <span>aaa + Space: Draw Arrow</span>
            <span>Alt+I: Eyedropper</span>
            <span>Ctrl+K: Search</span>
            <span>Tab: Zen Mode</span>
          </div>
        </div>
      )}

      {drawToolActive && (
        <div className="arrow-mode-banner">
          Free-Draw Pen Active · Drag anywhere to sketch (Esc to exit)
        </div>
      )}

      {(arrowToolActive || arrowDraft) && (
        <div className="arrow-mode-banner">
          {arrowDraft
            ? 'Move to aim arrow · Click to place endpoint (Esc to cancel)'
            : 'Click anywhere on canvas or a flowchart shape to start arrow (Esc to cancel)'}
        </div>
      )}

      {isDragOver && (
        <div className="drop-overlay">
          <span>Drop images, videos, 3D models, audio, code, or URLs</span>
        </div>
      )}
    </div>
  )
}
