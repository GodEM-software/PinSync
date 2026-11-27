import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import type {
  BoardDocument,
  BoardItem,
  BoardTheme,
  FlowchartShape,
  ItemType,
  ViewportState
} from './types/board'
import {
  alignSelectedItems,
  arrangeItemsOptimal,
  distributeSelectedItems,
  fitBoundsToViewport,
  getItemsBounds,
  normalizeSelectedSizes,
  screenToWorld,
  type AlignMode
} from './utils/boardMath'
import {
  classifyFileExtension,
  createArrowItem,
  createBoardItemFromFile,
  createCodeItem,
  createDrawingItem,
  createFlowchartItem,
  createImageItemFromDataUrl,
  createSwatchItem,
  createTextItem,
  createWebpageItem,
  getExtension,
  looksLikeCode,
  makeId,
  normalizeWebUrl
} from './utils/fileClassifier'
import {
  loadShortcutConfig,
  matchesShortcut,
  saveShortcutConfig,
  type ShortcutConfig
} from './utils/shortcuts'
import { useBoardHistory } from './hooks/useBoardHistory'
import { CanvasBoard, type ArrowDraft } from './components/CanvasBoard'
import { TopBar } from './components/TopBar'
import { StatusBar } from './components/StatusBar'
import { ContextMenu, type ContextMenuState } from './components/ContextMenu'
import { AddWebpageModal } from './components/AddWebpageModal'
import { ShortcutsModal } from './components/ShortcutsModal'
import { TextFormatPanel } from './components/TextFormatPanel'
import { ItemSearchModal } from './components/ItemSearchModal'
import { OnlineModal, type OnlineSessionInfo } from './components/OnlineModal'

interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}

export function App(): React.JSX.Element {
  const { items, commit, setTransient, snapshotBeforeDrag, undo, redo, resetHistory } =
    useBoardHistory([])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [interactiveItemId, setInteractiveItemId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<ViewportState>(() => ({
    panX: typeof window !== 'undefined' ? window.innerWidth / 2 : 660,
    panY: typeof window !== 'undefined' ? (window.innerHeight - 64) / 2 : 410,
    zoom: 1
  }))
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [canvasLocked, setCanvasLocked] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [smartGuides, setSmartGuides] = useState(true)
  const [zenMode, setZenMode] = useState(false)
  const [windowOpacity, setWindowOpacity] = useState(1)
  const [theme, setTheme] = useState<BoardTheme>('charcoal')
  const [isMaximized, setIsMaximized] = useState(false)
  const [boardFilePath, setBoardFilePath] = useState<string | undefined>(undefined)
  const [boardName, setBoardName] = useState('Untitled Board')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [webpageModalTarget, setWebpageModalTarget] = useState<{ x: number; y: number } | null>(
    null
  )
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showOnlineModal, setShowOnlineModal] = useState(false)
  const [onlineSession, setOnlineSession] = useState<OnlineSessionInfo | null>(null)
  const [shortcutConfig, setShortcutConfig] = useState<ShortcutConfig>(() => loadShortcutConfig())
  const [arrowToolActive, setArrowToolActive] = useState(false)
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null)
  const [drawToolActive, setDrawToolActive] = useState(false)
  const [penColor, setPenColor] = useState('#f1f5f9')
  const [penWidth, setPenWidth] = useState(3)
  const [penOpacity, setPenOpacity] = useState(1)
  const [formatPanelDismissedId, setFormatPanelDismissedId] = useState<string | null>(null)
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [toast, setToast] = useState<string | null>(null)

  const clipboardItemsRef = useRef<BoardItem[]>([])
  const toastTimerRef = useRef<number | null>(null)
  const autosaveLoadedRef = useRef(false)
  const clientIdRef = useRef('')
  const suppressOnlinePushRef = useRef(false)
  const itemsRef = useRef(items)
  const selectedIdsRef = useRef(selectedIds)
  const viewportRef = useRef(viewport)
  const shortcutConfigRef = useRef(shortcutConfig)
  const zenModeRef = useRef(zenMode)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    shortcutConfigRef.current = shortcutConfig
  }, [shortcutConfig])

  useEffect(() => {
    zenModeRef.current = zenMode
  }, [zenMode])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2100)
  }, [])

  // Restore last autosaved session on startup
  useEffect(() => {
    let mounted = true
    void window.api.loadAutosave().then((raw) => {
      if (!mounted) return
      autosaveLoadedRef.current = true
      if (!raw) return
      try {
        const doc = JSON.parse(raw) as BoardDocument
        if (Array.isArray(doc.items) && doc.items.length > 0) {
          resetHistory(doc.items)
          if (doc.viewport) setViewport(doc.viewport)
          if (doc.theme) setTheme(doc.theme)
          if (doc.name) setBoardName(doc.name)
        }
      } catch {
        // ignore corrupt autosave
      }
    })
    const unsub = window.api.onMaximizedChanged((val) => setIsMaximized(val))
    return () => {
      mounted = false
      unsub()
    }
  }, [resetHistory])

  // Debounced autosave to userData
  useEffect(() => {
    if (!autosaveLoadedRef.current) return
    const timer = window.setTimeout(() => {
      const doc: BoardDocument = {
        version: 1,
        name: boardName,
        theme,
        viewport,
        items
      }
      void window.api.saveAutosave(JSON.stringify(doc))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [boardName, items, theme, viewport])

  const handleUpdateShortcutConfig = useCallback((next: ShortcutConfig) => {
    setShortcutConfig(next)
    saveShortcutConfig(next)
  }, [])

  const getNextZIndex = useCallback((): number => {
    const maxZ = itemsRef.current.reduce((m, it) => Math.max(m, it.zIndex), 0)
    return maxZ + 1
  }, [])

  const getViewportCenterWorld = useCallback(() => {
    return screenToWorld(
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      viewportRef.current
    )
  }, [])

  const appendItems = useCallback(
    (newItems: BoardItem[]) => {
      if (newItems.length === 0) return
      commit((prev) => [...prev, ...newItems])
      setSelectedIds(newItems.map((it) => it.id))
      setFormatPanelDismissedId(null)
    },
    [commit]
  )

  const handleAddMediaDialog = useCallback(
    async (
      kind: Exclude<ItemType, 'webpage' | 'text' | 'flowchart' | 'arrow' | 'swatch' | 'drawing'>,
      worldX?: number,
      worldY?: number
    ) => {
      const paths = await window.api.openMediaDialog(kind)
      if (!paths || paths.length === 0) return
      const center =
        worldX !== undefined && worldY !== undefined
          ? { x: worldX, y: worldY }
          : getViewportCenterWorld()
      let z = getNextZIndex()
      const created = (
        await Promise.all(
          paths.map(async (p, idx) => {
            const offset = idx * 28
            const ext = getExtension(p)
            const textContent =
              classifyFileExtension(ext) === 'code' ? await window.api.readTextFile(p) : null
            return createBoardItemFromFile(
              p,
              center.x + offset,
              center.y + offset,
              z++,
              textContent
            )
          })
        )
      ).filter((it): it is BoardItem => it !== null)

      appendItems(created)
    },
    [appendItems, getNextZIndex, getViewportCenterWorld]
  )

  const handleDropFilesAndData = useCallback(
    async (dataTransfer: DataTransfer, worldX: number, worldY: number) => {
      const files = Array.from(dataTransfer.files || [])
      const uriList = dataTransfer.getData('text/uri-list') || ''
      const plainText = dataTransfer.getData('text/plain') || ''
      let z = getNextZIndex()

      if (files.length > 0) {
        const created = (
          await Promise.all(
            files.map(async (file, idx) => {
              let filePath: string
              try {
                filePath = window.api.getPathForFile(file)
              } catch {
                filePath = ''
              }
              if (!filePath && uriList.startsWith('file://')) {
                try {
                  const u = new URL(uriList.split(/\r?\n/)[0].trim())
                  filePath = decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, '$1')
                } catch {
                  filePath = ''
                }
              }
              if (!filePath) return null
              const offset = idx * 26
              const ext = getExtension(filePath)
              const kind = classifyFileExtension(ext)
              let textContent: string | null = null
              if (kind === 'code') {
                textContent = await window.api.readTextFile(filePath)
              }
              return createBoardItemFromFile(
                filePath,
                worldX + offset,
                worldY + offset,
                z++,
                textContent
              )
            })
          )
        ).filter((it): it is BoardItem => it !== null)

        if (created.length > 0) {
          appendItems(created)
          return
        }

        const firstExt = getExtension(files[0].name)
        if (['blend', 'max', 'c4d', 'ma', 'mb', 'skp'].includes(firstExt)) {
          showToast(
            `.${firstExt} is a proprietary project file — export as .glb, .fbx, .obj, or .step`
          )
          return
        }
      }

      const rawText = (uriList || plainText).trim()
      if (rawText) {
        const firstLine = rawText.split(/\r?\n/)[0]
        const maybeUrl = normalizeWebUrl(firstLine)
        if (maybeUrl && !rawText.includes('\n')) {
          appendItems([createWebpageItem(maybeUrl, worldX, worldY, z)])
          return
        }
        if (looksLikeCode(rawText)) {
          appendItems([createCodeItem(rawText, 'code', worldX, worldY, z, 'Dropped Code')])
          return
        }
        const textItem = createTextItem(worldX, worldY, z, rawText)
        appendItems([textItem])
        return
      }

      showToast('Unsupported drop item')
    },
    [appendItems, getNextZIndex, showToast]
  )

  const handleAddText = useCallback(
    (worldX?: number, worldY?: number, initialText = '') => {
      const pos =
        worldX !== undefined && worldY !== undefined
          ? { x: worldX, y: worldY }
          : getViewportCenterWorld()
      const item = createTextItem(pos.x, pos.y, getNextZIndex(), initialText)
      commit((prev) => [...prev, item])
      setSelectedIds([item.id])
      setFormatPanelDismissedId(null)
      setInteractiveItemId(item.id)
    },
    [commit, getNextZIndex, getViewportCenterWorld]
  )

  const handleDirectCanvasType = useCallback(
    (char: string, worldX: number, worldY: number) => {
      handleAddText(worldX, worldY, char)
    },
    [handleAddText]
  )

  const handleAddFlowchart = useCallback(
    (shape: FlowchartShape, worldX?: number, worldY?: number) => {
      const pos =
        worldX !== undefined && worldY !== undefined
          ? { x: worldX, y: worldY }
          : getViewportCenterWorld()
      const labelMap: Record<FlowchartShape, string> = {
        rect: 'Process',
        rounded: 'Step',
        diamond: 'Decision?',
        pill: 'Start / End',
        parallelogram: 'Input / Output',
        cylinder: 'Database'
      }
      const item = createFlowchartItem(shape, pos.x, pos.y, getNextZIndex(), labelMap[shape])
      appendItems([item])
    },
    [appendItems, getNextZIndex, getViewportCenterWorld]
  )

  const handleEyedropper = useCallback(
    async (worldX?: number, worldY?: number) => {
      const pos =
        worldX !== undefined && worldY !== undefined
          ? { x: worldX, y: worldY }
          : getViewportCenterWorld()
      const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => EyeDropperLike })
        .EyeDropper
      if (EyeDropperCtor) {
        try {
          const dropper = new EyeDropperCtor()
          const res = await dropper.open()
          const hex = res.sRGBHex.toUpperCase()
          void navigator.clipboard?.writeText(hex)
          appendItems([createSwatchItem(hex, pos.x, pos.y, getNextZIndex())])
          showToast(`Sampled ${hex} (copied to clipboard)`)
          return
        } catch {
          return
        }
      }
      appendItems([createSwatchItem('#60A5FA', pos.x, pos.y, getNextZIndex())])
    },
    [appendItems, getNextZIndex, getViewportCenterWorld, showToast]
  )

  const handleTriggerArrowFromText = useCallback(
    (textItem: BoardItem) => {
      if (!shortcutConfigRef.current.aaaArrowEnabled) return
      const startX = textItem.x - textItem.width / 2 + 12
      const startY = textItem.y
      commit((prev) => prev.filter((it) => it.id !== textItem.id))
      setInteractiveItemId(null)
      setSelectedIds([])
      setArrowToolActive(true)
      setArrowDraft({ startX, startY, endX: startX + 20, endY: startY })
    },
    [commit]
  )

  const handleStartArrowFromPort = useCallback((worldX: number, worldY: number) => {
    setArrowToolActive(true)
    setArrowDraft({ startX: worldX, startY: worldY, endX: worldX + 20, endY: worldY })
  }, [])

  const handleCommitArrow = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const dist = Math.hypot(x2 - x1, y2 - y1)
      if (dist >= 8) {
        const arrow = createArrowItem(x1, y1, x2, y2, getNextZIndex())
        appendItems([arrow])
      }
      setArrowDraft(null)
      setArrowToolActive(false)
    },
    [appendItems, getNextZIndex]
  )

  const handleCancelArrowTool = useCallback(() => {
    setArrowDraft(null)
    setArrowToolActive(false)
  }, [])

  const handleCommitDrawing = useCallback(
    (
      points: Array<{ x: number; y: number }>,
      color: string,
      strokeWidth: number,
      opacity: number
    ) => {
      if (points.length === 0) return
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const w = Math.max(16, maxX - minX)
      const h = Math.max(16, maxY - minY)
      const item = createDrawingItem(points, cx, cy, w, h, getNextZIndex(), color, strokeWidth)
      item.opacity = opacity
      commit((prev) => [...prev, item])
    },
    [commit, getNextZIndex]
  )

  const handleToggleDrawTool = useCallback(() => {
    setDrawToolActive((prev) => {
      const next = !prev
      if (next) {
        setArrowToolActive(false)
        setArrowDraft(null)
        setInteractiveItemId(null)
      }
      return next
    })
  }, [])

  const handlePaste = useCallback(
    async (worldX?: number, worldY?: number) => {
      const target =
        worldX !== undefined && worldY !== undefined
          ? { x: worldX, y: worldY }
          : getViewportCenterWorld()

      const sysClip = await window.api.readClipboard()
      if (sysClip?.kind === 'image' && sysClip.dataUrl) {
        const imgItem = createImageItemFromDataUrl(
          sysClip.dataUrl,
          target.x,
          target.y,
          getNextZIndex(),
          sysClip.width || 340,
          sysClip.height || 260
        )
        appendItems([imgItem])
        showToast('Pasted image from clipboard')
        return
      }

      if (sysClip?.kind === 'text' && sysClip.text) {
        const maybeUrl = normalizeWebUrl(sysClip.text)
        if (maybeUrl) {
          appendItems([createWebpageItem(maybeUrl, target.x, target.y, getNextZIndex())])
          showToast('Added webpage from clipboard URL')
          return
        }
        if (looksLikeCode(sysClip.text)) {
          appendItems([
            createCodeItem(sysClip.text, 'code', target.x, target.y, getNextZIndex(), 'Pasted Code')
          ])
          showToast('Pasted code snippet')
          return
        }
        appendItems([createTextItem(target.x, target.y, getNextZIndex(), sysClip.text)])
        showToast('Pasted text')
        return
      }

      if (clipboardItemsRef.current.length > 0) {
        let z = getNextZIndex()
        const clones = clipboardItemsRef.current.map((it) => ({
          ...it,
          id: makeId(),
          x: it.x + 28,
          y: it.y + 28,
          groupId: undefined,
          zIndex: z++
        }))
        appendItems(clones)
        showToast(`Pasted ${clones.length} board item(s)`)
      }
    },
    [appendItems, getNextZIndex, getViewportCenterWorld, showToast]
  )

  const handleDuplicateSelected = useCallback(() => {
    const sel = itemsRef.current.filter((it) => selectedIdsRef.current.includes(it.id))
    if (sel.length === 0) return
    let z = getNextZIndex()
    const clones = sel.map((it) => ({
      ...it,
      id: makeId(),
      x: it.x + 28,
      y: it.y + 28,
      locked: false,
      groupId: undefined,
      zIndex: z++
    }))
    appendItems(clones)
  }, [appendItems, getNextZIndex])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIdsRef.current.length === 0) return
    const toDelete = new Set(selectedIdsRef.current)
    commit((prev) => prev.filter((it) => !toDelete.has(it.id)))
    setSelectedIds([])
    if (interactiveItemId && toDelete.has(interactiveItemId)) {
      setInteractiveItemId(null)
    }
  }, [commit, interactiveItemId])

  const handleArrangeOptimal = useCallback(() => {
    const targetIds = selectedIdsRef.current.length > 1 ? new Set(selectedIdsRef.current) : null
    commit((prev) => {
      if (!targetIds) return arrangeItemsOptimal(prev)
      const subset = prev.filter((it) => targetIds.has(it.id))
      const packed = new Map(arrangeItemsOptimal(subset).map((it) => [it.id, it]))
      return prev.map((it) => packed.get(it.id) || it)
    })
    showToast('Arranged items optimally')
  }, [commit, showToast])

  const handleAlign = useCallback(
    (mode: AlignMode) => {
      commit((prev) => alignSelectedItems(prev, selectedIdsRef.current, mode))
    },
    [commit]
  )

  const handleDistribute = useCallback(
    (axis: 'x' | 'y') => {
      commit((prev) => distributeSelectedItems(prev, selectedIdsRef.current, axis))
    },
    [commit]
  )

  const handleNormalizeSize = useCallback(() => {
    commit((prev) => normalizeSelectedSizes(prev, selectedIdsRef.current))
    showToast('Normalized selected item sizes')
  }, [commit, showToast])

  const handleGroupSelected = useCallback(() => {
    if (selectedIdsRef.current.length < 2) return
    const gid = `grp_${Date.now().toString(36)}`
    const sel = new Set(selectedIdsRef.current)
    commit((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, groupId: gid } : it)))
    showToast(`Grouped ${sel.size} items`)
  }, [commit, showToast])

  const handleUngroupSelected = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    commit((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, groupId: undefined } : it)))
    showToast('Ungrouped items')
  }, [commit, showToast])

  const handleFitView = useCallback(() => {
    const target =
      selectedIdsRef.current.length > 0
        ? itemsRef.current.filter((it) => selectedIdsRef.current.includes(it.id))
        : itemsRef.current
    const topH = zenModeRef.current ? 0 : 64
    const bounds = getItemsBounds(target)
    if (!bounds) {
      setViewport({ panX: window.innerWidth / 2, panY: (window.innerHeight - topH) / 2, zoom: 1 })
      return
    }
    setViewport(fitBoundsToViewport(bounds, window.innerWidth, window.innerHeight - topH))
  }, [])

  const handleSetZoom = useCallback((nextZoom: number) => {
    const topH = zenModeRef.current ? 0 : 64
    const cx = window.innerWidth / 2
    const cy = (window.innerHeight - topH) / 2
    setViewport((vp) => {
      const scale = nextZoom / vp.zoom
      return {
        zoom: nextZoom,
        panX: cx - (cx - vp.panX) * scale,
        panY: cy - (cy - vp.panY) * scale
      }
    })
  }, [])

  const handleJumpToItem = useCallback((item: BoardItem) => {
    const topH = zenModeRef.current ? 0 : 64
    setSelectedIds([item.id])
    setViewport((vp) => ({
      ...vp,
      panX: window.innerWidth / 2 - item.x * vp.zoom,
      panY: (window.innerHeight - topH) / 2 - item.y * vp.zoom
    }))
  }, [])

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = await window.api.setAlwaysOnTop(!alwaysOnTop)
    setAlwaysOnTop(next)
    showToast(next ? 'Always on Top: ON' : 'Always on Top: OFF')
  }, [alwaysOnTop, showToast])

  const handleChangeWindowOpacity = useCallback(async (val: number) => {
    const next = await window.api.setWindowOpacity(val)
    setWindowOpacity(next)
  }, [])

  const handleToggleCanvasLock = useCallback(() => {
    setCanvasLocked((prev) => {
      const next = !prev
      showToast(next ? 'Canvas Locked' : 'Canvas Unlocked')
      return next
    })
  }, [showToast])

  const handleToggleLockSelected = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    const anyUnlocked = itemsRef.current.some((it) => sel.has(it.id) && !it.locked)
    commit((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, locked: anyUnlocked } : it)))
  }, [commit])

  const handleFlipSelected = useCallback(
    (axis: 'x' | 'y') => {
      const sel = new Set(selectedIdsRef.current)
      if (sel.size === 0) return
      commit((prev) =>
        prev.map((it) =>
          sel.has(it.id) && !it.locked
            ? axis === 'x'
              ? { ...it, flipX: !it.flipX }
              : { ...it, flipY: !it.flipY }
            : it
        )
      )
    },
    [commit]
  )

  const handleResetRotationSelected = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    commit((prev) => prev.map((it) => (sel.has(it.id) && !it.locked ? { ...it, rotation: 0 } : it)))
  }, [commit])

  const handleResetCropSelected = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    commit((prev) =>
      prev.map((it) => (sel.has(it.id) && it.type === 'image' ? { ...it, crop: undefined } : it))
    )
  }, [commit])

  const handleToggleGrayscaleSelected = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    commit((prev) =>
      prev.map((it) =>
        sel.has(it.id) && it.type === 'image' ? { ...it, grayscale: !it.grayscale } : it
      )
    )
  }, [commit])

  const handleOpacitySelected = useCallback(
    (opacity: number) => {
      const sel = new Set(selectedIdsRef.current)
      if (sel.size === 0) return
      setTransient((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, opacity } : it)))
    },
    [setTransient]
  )

  const handleBringToFront = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    let z = getNextZIndex()
    commit((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, zIndex: z++ } : it)))
  }, [commit, getNextZIndex])

  const handleSendToBack = useCallback(() => {
    const sel = new Set(selectedIdsRef.current)
    if (sel.size === 0) return
    const minZ = itemsRef.current.reduce((m, it) => Math.min(m, it.zIndex), 1)
    let z = minZ - sel.size
    commit((prev) => prev.map((it) => (sel.has(it.id) ? { ...it, zIndex: z++ } : it)))
  }, [commit])

  const handleNewBoard = useCallback(() => {
    resetHistory([])
    setSelectedIds([])
    setInteractiveItemId(null)
    setBoardFilePath(undefined)
    setBoardName('Untitled Board')
    setViewport({ panX: window.innerWidth / 2, panY: (window.innerHeight - 64) / 2, zoom: 1 })
    showToast('Started new board')
  }, [resetHistory, showToast])

  const handleSaveBoard = useCallback(async () => {
    const doc: BoardDocument = {
      version: 1,
      name: boardName,
      theme,
      viewport: viewportRef.current,
      items: itemsRef.current
    }
    const savedPath = await window.api.saveBoard({
      filePath: boardFilePath,
      content: JSON.stringify(doc, null, 2)
    })
    if (savedPath) {
      setBoardFilePath(savedPath)
      const fileName = savedPath.replace(/\\/g, '/').split('/').pop() || 'Saved Board'
      setBoardName(fileName.replace(/\.artbrd\.json$|\.json$/i, ''))
      showToast('Board saved')
    }
  }, [boardFilePath, boardName, showToast, theme])

  const handleOpenBoard = useCallback(async () => {
    const res = await window.api.openBoard()
    if (!res) return
    try {
      const doc = JSON.parse(res.content) as BoardDocument
      if (Array.isArray(doc.items)) {
        resetHistory(doc.items)
        if (doc.viewport) setViewport(doc.viewport)
        if (doc.theme) setTheme(doc.theme)
        setBoardFilePath(res.filePath)
        const fileName = res.filePath.replace(/\\/g, '/').split('/').pop() || 'Board'
        setBoardName(doc.name || fileName.replace(/\.artbrd\.json$|\.json$/i, ''))
        setSelectedIds([])
        setInteractiveItemId(null)
        showToast('Board loaded')
      }
    } catch {
      showToast('Invalid board file')
    }
  }, [resetHistory, showToast])

  const handleExportPng = useCallback(async () => {
    const saved = await window.api.exportPng()
    if (saved) showToast('Screenshot exported')
  }, [showToast])

  // Native OS Drag-Out when user drags an item outside the VisualDock window
  const handleNativeDragOut = useCallback(
    (item: BoardItem) => {
      if (item.type === 'drawing') {
        const xs = item.points.map((p) => p.x)
        const ys = item.points.map((p) => p.y)
        const minX = xs.length ? Math.min(...xs) : 0
        const minY = ys.length ? Math.min(...ys) : 0
        const d = item.points
          .map(
            (p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x - minX).toFixed(2)} ${(p.y - minY).toFixed(2)}`
          )
          .join(' ')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(item.width)}" height="${Math.ceil(item.height)}" viewBox="0 0 ${item.width} ${item.height}"><path d="${d}" fill="none" stroke="${item.color}" stroke-width="${item.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${item.opacity}"/></svg>`
        window.api.startNativeDragOut({ type: item.type, name: item.name, svgContent: svg })
      } else if (item.type === 'code') {
        window.api.startNativeDragOut({
          type: item.type,
          name: item.name,
          filePath: item.filePath,
          textContent: item.code
        })
      } else if (item.type === 'text') {
        window.api.startNativeDragOut({
          type: item.type,
          name: item.name || 'note',
          textContent: item.text
        })
      } else if ('src' in item) {
        window.api.startNativeDragOut({
          type: item.type,
          name: item.name,
          src: item.src,
          filePath: 'filePath' in item ? item.filePath : undefined
        })
      }
      showToast(`Dragging "${item.name}" out of board`)
    },
    [showToast]
  )

  // Online Mode: Publish, Join, and Live SSE Sync with Central Server
  const handlePublishBoard = useCallback(
    async (serverUrl: string, existingBoardId?: string) => {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '')
      const syncedItems = (await window.api.syncAssetsUp(cleanUrl, itemsRef.current)) as BoardItem[]
      suppressOnlinePushRef.current = true
      setTransient(() => syncedItems)

      const method = existingBoardId ? 'PUT' : 'POST'
      const endpoint = existingBoardId
        ? `${cleanUrl}/api/boards/${encodeURIComponent(existingBoardId)}`
        : `${cleanUrl}/api/boards`
      const resp = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: existingBoardId,
          name: boardName,
          theme,
          viewport: viewportRef.current,
          items: syncedItems,
          clientId: clientIdRef.current
        })
      })
      if (!resp.ok) throw new Error(`Server error HTTP ${resp.status}`)
      const doc = (await resp.json()) as { boardId: string; version: number }
      setOnlineSession({
        serverUrl: cleanUrl,
        boardId: doc.boardId,
        version: doc.version,
        connected: true
      })
      showToast(`Published to Central Server (${doc.boardId})`)
    },
    [boardName, setTransient, showToast, theme]
  )

  const handleJoinBoard = useCallback(
    async (serverUrl: string, boardId: string) => {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '')
      const resp = await fetch(`${cleanUrl}/api/boards/${encodeURIComponent(boardId)}`)
      if (!resp.ok) throw new Error(`Board "${boardId}" not found`)
      const doc = (await resp.json()) as {
        boardId: string
        name: string
        theme?: BoardTheme
        viewport?: ViewportState
        items: BoardItem[]
        version: number
      }
      const hydrated = (await window.api.syncAssetsDown(cleanUrl, doc.items || [])) as BoardItem[]
      suppressOnlinePushRef.current = true
      resetHistory(hydrated)
      if (doc.viewport) setViewport(doc.viewport)
      if (doc.theme) setTheme(doc.theme)
      if (doc.name) setBoardName(doc.name)
      setSelectedIds([])
      setInteractiveItemId(null)
      setOnlineSession({
        serverUrl: cleanUrl,
        boardId: doc.boardId,
        version: doc.version,
        connected: true
      })
      showToast(`Joined live board "${doc.name}" (${doc.boardId})`)
    },
    [resetHistory, showToast]
  )

  useEffect(() => {
    clientIdRef.current = `cli_${Math.random().toString(36).slice(2, 10)}`
  }, [])

  // Live SSE listener for incoming updates from other peers
  const onlineServerUrl = onlineSession?.serverUrl
  const onlineBoardId = onlineSession?.boardId

  useEffect(() => {
    if (!onlineServerUrl || !onlineBoardId) return
    const es = new EventSource(
      `${onlineServerUrl}/api/boards/${encodeURIComponent(onlineBoardId)}/events`
    )
    es.addEventListener('board-updated', (ev) => {
      void (async () => {
        try {
          const doc = JSON.parse((ev as MessageEvent).data) as {
            name?: string
            theme?: BoardTheme
            items: BoardItem[]
            version: number
            updatedBy?: string
          }
          if (doc.updatedBy === clientIdRef.current) return
          const hydrated = (await window.api.syncAssetsDown(
            onlineServerUrl,
            doc.items || []
          )) as BoardItem[]
          suppressOnlinePushRef.current = true
          setTransient(() => hydrated)
          if (doc.theme) setTheme(doc.theme)
          if (doc.name) setBoardName(doc.name)
          setOnlineSession((prev) => (prev ? { ...prev, version: doc.version } : prev))
        } catch {
          // ignore malformed SSE update
        }
      })()
    })
    return () => es.close()
  }, [onlineBoardId, onlineServerUrl, setTransient])

  // Debounced auto-push to central server when local board is edited in Online Mode
  useEffect(() => {
    if (!onlineServerUrl || !onlineBoardId) return
    if (suppressOnlinePushRef.current) {
      suppressOnlinePushRef.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const syncedItems = (await window.api.syncAssetsUp(
            onlineServerUrl,
            itemsRef.current
          )) as BoardItem[]
          const resp = await fetch(
            `${onlineServerUrl}/api/boards/${encodeURIComponent(onlineBoardId)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: boardName,
                theme,
                viewport: viewportRef.current,
                items: syncedItems,
                clientId: clientIdRef.current
              })
            }
          )
          if (resp.ok) {
            const doc = (await resp.json()) as { version: number }
            setOnlineSession((prev) => (prev ? { ...prev, version: doc.version } : prev))
          }
        } catch {
          // ignore transient network errors during live sync
        }
      })()
    }, 550)
    return () => window.clearTimeout(timer)
  }, [boardName, items, onlineBoardId, onlineServerUrl, theme])

  // Dynamic customizable keyboard shortcuts
  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (showShortcuts || showSearch) return
      if (isTyping(e.target)) return
      const b = shortcutConfigRef.current.bindings

      if (matchesShortcut(e, b.shortcutSettings)) {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }
      if (matchesShortcut(e, b.zenMode)) {
        e.preventDefault()
        setZenMode((z) => !z)
        return
      }
      if (matchesShortcut(e, b.searchItems)) {
        e.preventDefault()
        setShowSearch(true)
        return
      }
      if (matchesShortcut(e, b.eyedropper)) {
        e.preventDefault()
        void handleEyedropper()
        return
      }
      if (matchesShortcut(e, b.paste)) {
        e.preventDefault()
        void handlePaste()
        return
      }
      if (matchesShortcut(e, b.copy)) {
        const sel = itemsRef.current.filter((it) => selectedIdsRef.current.includes(it.id))
        if (sel.length > 0) {
          clipboardItemsRef.current = sel
          showToast(`Copied ${sel.length} item(s)`)
        }
        return
      }
      if (matchesShortcut(e, b.duplicate)) {
        e.preventDefault()
        handleDuplicateSelected()
        return
      }
      if (matchesShortcut(e, b.selectAll)) {
        e.preventDefault()
        setSelectedIds(itemsRef.current.map((it) => it.id))
        return
      }
      if (matchesShortcut(e, b.group)) {
        e.preventDefault()
        handleGroupSelected()
        return
      }
      if (matchesShortcut(e, b.ungroup)) {
        e.preventDefault()
        handleUngroupSelected()
        return
      }
      if (matchesShortcut(e, b.normalizeSize)) {
        e.preventDefault()
        handleNormalizeSize()
        return
      }
      if (matchesShortcut(e, b.addText)) {
        e.preventDefault()
        handleAddText()
        return
      }
      if (matchesShortcut(e, b.arrowTool)) {
        e.preventDefault()
        setDrawToolActive(false)
        setArrowToolActive((prev) => !prev)
        setArrowDraft(null)
        return
      }
      if (matchesShortcut(e, b.drawTool)) {
        e.preventDefault()
        handleToggleDrawTool()
        return
      }
      if (matchesShortcut(e, b.addFlowchart)) {
        e.preventDefault()
        handleAddFlowchart('rect')
        return
      }
      if (matchesShortcut(e, b.alwaysOnTop)) {
        e.preventDefault()
        void handleToggleAlwaysOnTop()
        return
      }
      if (matchesShortcut(e, b.lockCanvas)) {
        e.preventDefault()
        handleToggleCanvasLock()
        return
      }
      if (matchesShortcut(e, b.arrangeOptimal)) {
        e.preventDefault()
        handleArrangeOptimal()
        return
      }
      if (matchesShortcut(e, b.addWebpage)) {
        e.preventDefault()
        setWebpageModalTarget(getViewportCenterWorld())
        return
      }
      if (matchesShortcut(e, b.newBoard)) {
        e.preventDefault()
        handleNewBoard()
        return
      }
      if (matchesShortcut(e, b.saveBoard)) {
        e.preventDefault()
        void handleSaveBoard()
        return
      }
      if (matchesShortcut(e, b.openBoard)) {
        e.preventDefault()
        void handleOpenBoard()
        return
      }
      if (matchesShortcut(e, b.exportPng)) {
        e.preventDefault()
        void handleExportPng()
        return
      }
      if (matchesShortcut(e, b.resetZoom)) {
        e.preventDefault()
        handleSetZoom(1)
        return
      }
      if (matchesShortcut(e, b.undo)) {
        e.preventDefault()
        undo()
        return
      }
      if (matchesShortcut(e, b.redo) || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault()
        redo()
        return
      }
      if (matchesShortcut(e, b.lockItem)) {
        e.preventDefault()
        handleToggleLockSelected()
        return
      }
      if (matchesShortcut(e, b.flipX)) {
        e.preventDefault()
        handleFlipSelected('x')
        return
      }
      if (matchesShortcut(e, b.flipY)) {
        e.preventDefault()
        handleFlipSelected('y')
        return
      }
      if (matchesShortcut(e, b.resetCrop)) {
        e.preventDefault()
        handleResetCropSelected()
        return
      }
      if (matchesShortcut(e, b.delete) || (!interactiveItemId && e.key === 'Backspace')) {
        e.preventDefault()
        handleDeleteSelected()
        return
      }
      if (matchesShortcut(e, b.fitView)) {
        e.preventDefault()
        handleFitView()
        return
      }
      if (matchesShortcut(e, b.bringFront)) {
        e.preventDefault()
        handleBringToFront()
        return
      }
      if (matchesShortcut(e, b.sendBack)) {
        e.preventDefault()
        handleSendToBack()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    getViewportCenterWorld,
    handleAddFlowchart,
    handleAddText,
    handleArrangeOptimal,
    handleBringToFront,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleExportPng,
    handleEyedropper,
    handleFitView,
    handleFlipSelected,
    handleGroupSelected,
    handleNewBoard,
    handleNormalizeSize,
    handleOpenBoard,
    handlePaste,
    handleResetCropSelected,
    handleSaveBoard,
    handleSendToBack,
    handleSetZoom,
    handleToggleAlwaysOnTop,
    handleToggleCanvasLock,
    handleToggleDrawTool,
    handleToggleLockSelected,
    handleUngroupSelected,
    interactiveItemId,
    redo,
    showSearch,
    showShortcuts,
    showToast,
    undo
  ])

  const selectedItems = items.filter((it) => selectedIds.includes(it.id))
  const singleSelected = selectedItems.length === 1 ? selectedItems[0] : null
  const formatTarget =
    singleSelected &&
    (singleSelected.type === 'text' ||
      singleSelected.type === 'flowchart' ||
      singleSelected.type === 'arrow') &&
    formatPanelDismissedId !== singleSelected.id
      ? singleSelected
      : null

  return (
    <div className="app-shell">
      {!zenMode && (
        <TopBar
          boardName={boardName}
          itemCount={items.length}
          alwaysOnTop={alwaysOnTop}
          canvasLocked={canvasLocked}
          showGrid={showGrid}
          isMaximized={isMaximized}
          interactiveActive={Boolean(interactiveItemId)}
          arrowToolActive={arrowToolActive || Boolean(arrowDraft)}
          drawToolActive={drawToolActive}
          onlineActive={Boolean(onlineSession)}
          windowOpacity={windowOpacity}
          theme={theme}
          onAddMedia={(kind) => void handleAddMediaDialog(kind)}
          onAddWebpage={() => setWebpageModalTarget(getViewportCenterWorld())}
          onAddText={() => handleAddText()}
          onAddFlowchart={(shape) => handleAddFlowchart(shape)}
          onToggleArrowTool={() => {
            setDrawToolActive(false)
            setArrowToolActive((prev) => !prev)
            setArrowDraft(null)
          }}
          onToggleDrawTool={handleToggleDrawTool}
          onEyedropper={() => void handleEyedropper()}
          onSearchItems={() => setShowSearch(true)}
          onArrangeOptimal={handleArrangeOptimal}
          onFitView={handleFitView}
          onToggleAlwaysOnTop={() => void handleToggleAlwaysOnTop()}
          onToggleCanvasLock={handleToggleCanvasLock}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onChangeWindowOpacity={(val) => void handleChangeWindowOpacity(val)}
          onChangeTheme={setTheme}
          onNewBoard={handleNewBoard}
          onOpenBoard={() => void handleOpenBoard()}
          onSaveBoard={() => void handleSaveBoard()}
          onExportPng={() => void handleExportPng()}
          onToggleZenMode={() => setZenMode(true)}
          onShowShortcuts={() => setShowShortcuts(true)}
          onOpenOnline={() => setShowOnlineModal(true)}
          onExitInteractive={() => setInteractiveItemId(null)}
        />
      )}

      {zenMode && (
        <button
          className="zen-restore-pill"
          onClick={() => setZenMode(false)}
          title="Exit Zen Mode (Tab)"
        >
          <Eye size={13} /> <span>Exit Zen (Tab)</span>
        </button>
      )}

      <CanvasBoard
        items={items}
        selectedIds={selectedIds}
        interactiveItemId={interactiveItemId}
        viewport={viewport}
        canvasLocked={canvasLocked}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        smartGuides={smartGuides}
        theme={theme}
        arrowToolActive={arrowToolActive}
        arrowDraft={arrowDraft}
        drawToolActive={drawToolActive}
        penColor={penColor}
        penWidth={penWidth}
        penOpacity={penOpacity}
        onArrowDraftChange={setArrowDraft}
        onCommitArrow={handleCommitArrow}
        onStartArrowFromPort={handleStartArrowFromPort}
        onCancelArrowTool={handleCancelArrowTool}
        onCommitDrawing={handleCommitDrawing}
        onCancelDrawTool={() => setDrawToolActive(false)}
        onDirectCanvasType={handleDirectCanvasType}
        onTriggerArrowFromText={handleTriggerArrowFromText}
        onCursorWorldMove={setCursorWorld}
        onViewportChange={setViewport}
        onSelectionChange={(ids) => {
          setSelectedIds(ids)
          setFormatPanelDismissedId(null)
        }}
        onInteractiveChange={setInteractiveItemId}
        onItemsTransient={setTransient}
        onItemsCommit={commit}
        onSnapshotBeforeDrag={snapshotBeforeDrag}
        onDropFilesAndData={(dt, wx, wy) => void handleDropFilesAndData(dt, wx, wy)}
        onNativeDragOut={handleNativeDragOut}
        onOpenContextMenu={(x, y, worldX, worldY, targetItemId) =>
          setContextMenu({ x, y, worldX, worldY, targetItemId })
        }
      />

      {!zenMode && (
        <StatusBar
          selectedCount={selectedIds.length}
          cursorWorld={cursorWorld}
          zoom={viewport.zoom}
          snapToGrid={snapToGrid}
          smartGuides={smartGuides}
          arrowActive={arrowToolActive || Boolean(arrowDraft)}
          canvasLocked={canvasLocked}
          onToggleSnapToGrid={() => setSnapToGrid((s) => !s)}
          onToggleSmartGuides={() => setSmartGuides((g) => !g)}
          onSetZoom={handleSetZoom}
          onFitView={handleFitView}
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onNormalizeSize={handleNormalizeSize}
          onGroup={handleGroupSelected}
          onUngroup={handleUngroupSelected}
        />
      )}

      {formatTarget && (
        <TextFormatPanel
          item={formatTarget}
          onUpdate={(id, patch) =>
            commit((prev) =>
              prev.map((it) => (it.id === id ? ({ ...it, ...patch } as BoardItem) : it))
            )
          }
          onClose={() => setFormatPanelDismissedId(formatTarget.id)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          selectedItems={selectedItems}
          alwaysOnTop={alwaysOnTop}
          canvasLocked={canvasLocked}
          showGrid={showGrid}
          zenMode={zenMode}
          onClose={() => setContextMenu(null)}
          onAddMedia={(kind, wx, wy) => void handleAddMediaDialog(kind, wx, wy)}
          onAddWebpage={(wx, wy) => setWebpageModalTarget({ x: wx, y: wy })}
          onAddText={(wx, wy) => handleAddText(wx, wy)}
          onAddFlowchart={(shape, wx, wy) => handleAddFlowchart(shape, wx, wy)}
          onStartArrowAt={(wx, wy) => {
            setArrowToolActive(true)
            setArrowDraft({ startX: wx, startY: wy, endX: wx + 20, endY: wy })
          }}
          onEyedropper={(wx, wy) => void handleEyedropper(wx, wy)}
          onPaste={(wx, wy) => void handlePaste(wx, wy)}
          onSearchItems={() => setShowSearch(true)}
          onArrangeOptimal={handleArrangeOptimal}
          onFitView={handleFitView}
          onToggleAlwaysOnTop={() => void handleToggleAlwaysOnTop()}
          onToggleCanvasLock={handleToggleCanvasLock}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onToggleZenMode={() => setZenMode((z) => !z)}
          onNewBoard={handleNewBoard}
          onOpenBoard={() => void handleOpenBoard()}
          onSaveBoard={() => void handleSaveBoard()}
          onExportPng={() => void handleExportPng()}
          onShowShortcuts={() => setShowShortcuts(true)}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onToggleLockSelected={handleToggleLockSelected}
          onFlipSelected={handleFlipSelected}
          onResetRotationSelected={handleResetRotationSelected}
          onResetCropSelected={handleResetCropSelected}
          onToggleGrayscaleSelected={handleToggleGrayscaleSelected}
          onOpacitySelected={handleOpacitySelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onGroupSelected={handleGroupSelected}
          onUngroupSelected={handleUngroupSelected}
          onNormalizeSelected={handleNormalizeSize}
          onInteractItem={(id) => setInteractiveItemId(id)}
        />
      )}

      {showSearch && (
        <ItemSearchModal
          items={items}
          onJumpToItem={handleJumpToItem}
          onClose={() => setShowSearch(false)}
        />
      )}

      {webpageModalTarget && (
        <AddWebpageModal
          onClose={() => setWebpageModalTarget(null)}
          onConfirm={(url) => {
            appendItems([
              createWebpageItem(url, webpageModalTarget.x, webpageModalTarget.y, getNextZIndex())
            ])
            setWebpageModalTarget(null)
          }}
        />
      )}

      {showShortcuts && (
        <ShortcutsModal
          config={shortcutConfig}
          onChange={handleUpdateShortcutConfig}
          onClose={() => setShowShortcuts(false)}
        />
      )}

      {showOnlineModal && (
        <OnlineModal
          session={onlineSession}
          initialServerUrl="http://127.0.0.1:4580"
          onClose={() => setShowOnlineModal(false)}
          onPublishBoard={handlePublishBoard}
          onJoinBoard={handleJoinBoard}
          onDisconnect={() => {
            setOnlineSession(null)
            showToast('Disconnected from Central Server')
          }}
        />
      )}

      {drawToolActive && !zenMode && (
        <div className="pen-palette-pill no-drag">
          <div className="pen-swatches">
            {['#f1f5f9', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc'].map((c) => (
              <button
                key={c}
                type="button"
                className={`fp-swatch ${penColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setPenColor(c)}
                title={`Pen color ${c}`}
              />
            ))}
            <input
              type="color"
              className="fp-color-input"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              title="Custom pen color"
            />
          </div>
          <div className="dock-sep" />
          <div className="pen-sizes">
            {[2, 4, 8, 14].map((w) => (
              <button
                key={w}
                type="button"
                className={`pen-size-btn ${penWidth === w ? 'active' : ''}`}
                onClick={() => setPenWidth(w)}
                title={`${w}px stroke`}
              >
                <span
                  style={{
                    width: Math.min(14, w + 2),
                    height: Math.min(14, w + 2),
                    borderRadius: '50%',
                    background: penColor
                  }}
                />
              </button>
            ))}
          </div>
          <div className="dock-sep" />
          <label className="pen-opacity-label" title="Stroke opacity">
            <span>{Math.round(penOpacity * 100)}%</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={penOpacity}
              onChange={(e) => setPenOpacity(parseFloat(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            style={{ height: 24, padding: '0 10px', fontSize: 11 }}
            onClick={() => setDrawToolActive(false)}
          >
            Done
          </button>
        </div>
      )}

      {toast && <div className="toast-pill">{toast}</div>}
    </div>
  )
}

export default App
