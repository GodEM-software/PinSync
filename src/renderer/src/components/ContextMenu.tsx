import React, { useEffect, useRef } from 'react'
import {
  ArrowUpRight,
  Box,
  Camera,
  Clipboard,
  Code2,
  Copy,
  Eye,
  FilePlus2,
  FlipHorizontal,
  FlipVertical,
  FolderOpen,
  Globe,
  Grid,
  Group,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutGrid,
  Lock,
  Maximize,
  Maximize2,
  MousePointerClick,
  Music,
  Pin,
  Pipette,
  RotateCcw,
  Save,
  Search,
  Shapes,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  Video
} from 'lucide-react'
import type { BoardItem, FlowchartShape, ItemType } from '../types/board'

export interface ContextMenuState {
  x: number
  y: number
  worldX: number
  worldY: number
  targetItemId: string | null
}

interface ContextMenuProps {
  menu: ContextMenuState
  selectedItems: BoardItem[]
  alwaysOnTop: boolean
  canvasLocked: boolean
  showGrid: boolean
  zenMode: boolean
  onClose: () => void
  onAddMedia: (
    kind: Exclude<ItemType, 'webpage' | 'text' | 'flowchart' | 'arrow' | 'swatch' | 'drawing'>,
    worldX: number,
    worldY: number
  ) => void
  onAddWebpage: (worldX: number, worldY: number) => void
  onAddText: (worldX: number, worldY: number) => void
  onAddFlowchart: (shape: FlowchartShape, worldX: number, worldY: number) => void
  onStartArrowAt: (worldX: number, worldY: number) => void
  onEyedropper: (worldX: number, worldY: number) => void
  onPaste: (worldX: number, worldY: number) => void
  onSearchItems: () => void
  onArrangeOptimal: () => void
  onFitView: () => void
  onToggleAlwaysOnTop: () => void
  onToggleCanvasLock: () => void
  onToggleGrid: () => void
  onToggleZenMode: () => void
  onNewBoard: () => void
  onOpenBoard: () => void
  onSaveBoard: () => void
  onExportPng: () => void
  onShowShortcuts: () => void
  onDuplicateSelected: () => void
  onDeleteSelected: () => void
  onToggleLockSelected: () => void
  onFlipSelected: (axis: 'x' | 'y') => void
  onResetRotationSelected: () => void
  onResetCropSelected: () => void
  onToggleGrayscaleSelected: () => void
  onOpacitySelected: (opacity: number) => void
  onBringToFront: () => void
  onSendToBack: () => void
  onGroupSelected: () => void
  onUngroupSelected: () => void
  onNormalizeSelected: () => void
  onInteractItem: (id: string) => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  selectedItems,
  alwaysOnTop,
  canvasLocked,
  showGrid,
  zenMode,
  onClose,
  onAddMedia,
  onAddWebpage,
  onAddText,
  onAddFlowchart,
  onStartArrowAt,
  onEyedropper,
  onPaste,
  onSearchItems,
  onArrangeOptimal,
  onFitView,
  onToggleAlwaysOnTop,
  onToggleCanvasLock,
  onToggleGrid,
  onToggleZenMode,
  onNewBoard,
  onOpenBoard,
  onSaveBoard,
  onExportPng,
  onShowShortcuts,
  onDuplicateSelected,
  onDeleteSelected,
  onToggleLockSelected,
  onFlipSelected,
  onResetRotationSelected,
  onResetCropSelected,
  onToggleGrayscaleSelected,
  onOpacitySelected,
  onBringToFront,
  onSendToBack,
  onGroupSelected,
  onUngroupSelected,
  onNormalizeSelected,
  onInteractItem
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const clampedLeft = Math.min(menu.x, window.innerWidth - 252)
  const clampedTop = Math.min(menu.y, window.innerHeight - 540)
  const hasSelection = selectedItems.length > 0
  const multiSelected = selectedItems.length > 1
  const primary = selectedItems[0]
  const hasImage = selectedItems.some((it) => it.type === 'image')
  const anyLocked = selectedItems.some((it) => it.locked)
  const anyGrouped = selectedItems.some((it) => Boolean(it.groupId))

  const act = (fn: () => void) => (): void => {
    fn()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: Math.max(8, clampedLeft), top: Math.max(12, clampedTop) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-section-label">Add Content</div>
      <div className="ctx-grid-add">
        <button
          className="ctx-chip"
          onClick={act(() => onAddMedia('image', menu.worldX, menu.worldY))}
        >
          <ImageIcon size={13} /> Image
        </button>
        <button
          className="ctx-chip"
          onClick={act(() => onAddMedia('video', menu.worldX, menu.worldY))}
        >
          <Video size={13} /> Video
        </button>
        <button className="ctx-chip" onClick={act(() => onAddWebpage(menu.worldX, menu.worldY))}>
          <Globe size={13} /> Webpage
        </button>
        <button
          className="ctx-chip"
          onClick={act(() => onAddMedia('sound', menu.worldX, menu.worldY))}
        >
          <Music size={13} /> Sound
        </button>
        <button
          className="ctx-chip"
          onClick={act(() => onAddMedia('model3d', menu.worldX, menu.worldY))}
        >
          <Box size={13} /> 3D Model
        </button>
        <button
          className="ctx-chip"
          onClick={act(() => onAddMedia('code', menu.worldX, menu.worldY))}
        >
          <Code2 size={13} /> Code File
        </button>
        <button className="ctx-chip" onClick={act(() => onAddText(menu.worldX, menu.worldY))}>
          <Type size={13} /> Text
        </button>
        <button className="ctx-chip" onClick={act(() => onStartArrowAt(menu.worldX, menu.worldY))}>
          <ArrowUpRight size={13} /> Arrow
        </button>
        <button
          className="ctx-chip"
          onClick={act(() => onAddFlowchart('rect', menu.worldX, menu.worldY))}
        >
          <Shapes size={13} /> Flow Box
        </button>
        <button className="ctx-chip" onClick={act(() => onEyedropper(menu.worldX, menu.worldY))}>
          <Pipette size={13} /> Swatch
        </button>
        <button className="ctx-chip" onClick={act(() => onPaste(menu.worldX, menu.worldY))}>
          <Clipboard size={13} /> Paste
        </button>
      </div>

      {hasSelection && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-section-label">Selection ({selectedItems.length})</div>

          {primary &&
            (primary.type === 'webpage' ||
              primary.type === 'model3d' ||
              primary.type === 'video' ||
              primary.type === 'text' ||
              primary.type === 'flowchart' ||
              primary.type === 'code') && (
              <button className="ctx-item" onClick={act(() => onInteractItem(primary.id))}>
                <MousePointerClick size={14} />
                <span>Edit / Interact</span>
                <kbd>DblClick</kbd>
              </button>
            )}

          {multiSelected && (
            <>
              <button className="ctx-item" onClick={act(onGroupSelected)}>
                <Group size={14} />
                <span>Group Items</span>
                <kbd>Ctrl+G</kbd>
              </button>
              <button className="ctx-item" onClick={act(onNormalizeSelected)}>
                <Maximize size={14} />
                <span>Normalize Sizes</span>
              </button>
            </>
          )}

          {anyGrouped && (
            <button className="ctx-item" onClick={act(onUngroupSelected)}>
              <Ungroup size={14} />
              <span>Ungroup</span>
            </button>
          )}

          <button className="ctx-item" onClick={act(onBringToFront)}>
            <Layers size={14} />
            <span>Bring to Front</span>
          </button>
          <button className="ctx-item" onClick={act(onSendToBack)}>
            <Layers size={14} />
            <span>Send to Back</span>
          </button>

          <button className="ctx-item" onClick={act(() => onFlipSelected('x'))}>
            <FlipHorizontal size={14} />
            <span>Flip Horizontal</span>
          </button>
          <button className="ctx-item" onClick={act(() => onFlipSelected('y'))}>
            <FlipVertical size={14} />
            <span>Flip Vertical</span>
          </button>

          <button className="ctx-item" onClick={act(onResetRotationSelected)}>
            <RotateCcw size={14} />
            <span>Reset Rotation</span>
          </button>

          {hasImage && (
            <>
              <button className="ctx-item" onClick={act(onToggleGrayscaleSelected)}>
                <ImageIcon size={14} />
                <span>Toggle Grayscale</span>
              </button>
              <button className="ctx-item" onClick={act(onResetCropSelected)}>
                <RotateCcw size={14} />
                <span>Reset Crop</span>
              </button>
            </>
          )}

          <div className="ctx-slider-row">
            <span>Opacity</span>
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={primary?.opacity ?? 1}
              onChange={(e) => onOpacitySelected(parseFloat(e.target.value))}
            />
            <span className="ctx-val">{Math.round((primary?.opacity ?? 1) * 100)}%</span>
          </div>

          <button className="ctx-item" onClick={act(onToggleLockSelected)}>
            {anyLocked ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{anyLocked ? 'Unlock Item(s)' : 'Lock Item(s)'}</span>
          </button>

          <button className="ctx-item" onClick={act(onDuplicateSelected)}>
            <Copy size={14} />
            <span>Duplicate</span>
          </button>
          <button className="ctx-item danger" onClick={act(onDeleteSelected)}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </>
      )}

      <div className="ctx-divider" />
      <div className="ctx-section-label">Board &amp; Window</div>

      <button className="ctx-item" onClick={act(onSearchItems)}>
        <Search size={14} />
        <span>Jump to Item…</span>
        <kbd>Ctrl+K</kbd>
      </button>
      <button className="ctx-item" onClick={act(onArrangeOptimal)}>
        <LayoutGrid size={14} />
        <span>Arrange Optimal</span>
      </button>
      <button className="ctx-item" onClick={act(onFitView)}>
        <Maximize2 size={14} />
        <span>Fit View</span>
      </button>
      <button className="ctx-item" onClick={act(onToggleGrid)}>
        <Grid size={14} />
        <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
      </button>
      <button className="ctx-item" onClick={act(onToggleZenMode)}>
        <Eye size={14} />
        <span>{zenMode ? 'Exit Zen Mode' : 'Zen / Minimal Mode'}</span>
        <kbd>Tab</kbd>
      </button>
      <button className="ctx-item" onClick={act(onToggleAlwaysOnTop)}>
        <Pin size={14} />
        <span>{alwaysOnTop ? 'Disable Always on Top' : 'Always on Top'}</span>
      </button>
      <button className="ctx-item" onClick={act(onToggleCanvasLock)}>
        <Lock size={14} />
        <span>{canvasLocked ? 'Unlock Canvas' : 'Lock Canvas'}</span>
      </button>

      <div className="ctx-divider" />
      <button className="ctx-item" onClick={act(onNewBoard)}>
        <FilePlus2 size={14} />
        <span>New Board</span>
      </button>
      <button className="ctx-item" onClick={act(onOpenBoard)}>
        <FolderOpen size={14} />
        <span>Open Board…</span>
      </button>
      <button className="ctx-item" onClick={act(onSaveBoard)}>
        <Save size={14} />
        <span>Save Board…</span>
      </button>
      <button className="ctx-item" onClick={act(onExportPng)}>
        <Camera size={14} />
        <span>Export PNG…</span>
      </button>
      <button className="ctx-item" onClick={act(onShowShortcuts)}>
        <Keyboard size={14} />
        <span>Shortcut Settings…</span>
      </button>
    </div>
  )
}
