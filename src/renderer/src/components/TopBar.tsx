import React, { useState } from 'react'
import {
  ArrowUpRight,
  Box,
  Camera,
  Cloud,
  Code2,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Globe,
  Grid,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  Lock,
  Maximize2,
  Minus,
  Music,
  Palette,
  Pencil,
  Pin,
  Pipette,
  Save,
  Search,
  Shapes,
  SlidersHorizontal,
  Square,
  Type,
  Unlock,
  Video,
  X
} from 'lucide-react'
import type { BoardTheme, FlowchartShape, ItemType } from '../types/board'

interface TopBarProps {
  boardName: string
  itemCount: number
  alwaysOnTop: boolean
  canvasLocked: boolean
  showGrid: boolean
  isMaximized: boolean
  interactiveActive: boolean
  arrowToolActive: boolean
  drawToolActive: boolean
  onlineActive: boolean
  windowOpacity: number
  theme: BoardTheme
  onAddMedia: (
    kind: Exclude<ItemType, 'webpage' | 'text' | 'flowchart' | 'arrow' | 'swatch' | 'drawing'>
  ) => void
  onAddWebpage: () => void
  onAddText: () => void
  onAddFlowchart: (shape: FlowchartShape) => void
  onToggleArrowTool: () => void
  onToggleDrawTool: () => void
  onEyedropper: () => void
  onSearchItems: () => void
  onArrangeOptimal: () => void
  onFitView: () => void
  onToggleAlwaysOnTop: () => void
  onToggleCanvasLock: () => void
  onToggleGrid: () => void
  onChangeWindowOpacity: (opacity: number) => void
  onChangeTheme: (theme: BoardTheme) => void
  onNewBoard: () => void
  onOpenBoard: () => void
  onSaveBoard: () => void
  onExportPng: () => void
  onToggleZenMode: () => void
  onShowShortcuts: () => void
  onOpenOnline: () => void
  onExitInteractive: () => void
}

const THEMES: { id: BoardTheme; label: string; color: string }[] = [
  { id: 'charcoal', label: 'Charcoal', color: '#1a1c24' },
  { id: 'obsidian', label: 'Obsidian', color: '#0c0d12' },
  { id: 'neutral', label: 'Neutral', color: '#2b2e37' },
  { id: 'slate', label: 'Slate', color: '#1b2434' },
  { id: 'blueprint', label: 'Blueprint', color: '#11213a' }
]

export const TopBar: React.FC<TopBarProps> = ({
  boardName,
  itemCount,
  alwaysOnTop,
  canvasLocked,
  showGrid,
  isMaximized,
  interactiveActive,
  arrowToolActive,
  drawToolActive,
  onlineActive,
  windowOpacity,
  theme,
  onAddMedia,
  onAddWebpage,
  onAddText,
  onAddFlowchart,
  onToggleArrowTool,
  onToggleDrawTool,
  onEyedropper,
  onSearchItems,
  onArrangeOptimal,
  onFitView,
  onToggleAlwaysOnTop,
  onToggleCanvasLock,
  onToggleGrid,
  onChangeWindowOpacity,
  onChangeTheme,
  onNewBoard,
  onOpenBoard,
  onSaveBoard,
  onExportPng,
  onToggleZenMode,
  onShowShortcuts,
  onOpenOnline,
  onExitInteractive
}) => {
  const [showAppearance, setShowAppearance] = useState(false)
  const [showFlowShapes, setShowFlowShapes] = useState(false)

  return (
    <>
      {/* Top-Left Floating Brand & Board Pill */}
      <div
        className="window-brand-pill"
        onDoubleClick={() => void window.api.toggleMaximizeWindow()}
      >
        <span className="brand-dot" />
        <span className="brand-app-name">PinSync</span>
        <span className="brand-divider">·</span>
        <span className="brand-title">{boardName}</span>
        <span className="board-meta">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        {interactiveActive && (
          <button
            className="interact-pill no-drag"
            onClick={onExitInteractive}
            title="Press Esc to return to board mode"
          >
            Editing (Esc)
          </button>
        )}
      </div>

      {/* Top-Right Floating Window Controls */}
      <div className="window-controls-pill no-drag">
        <button
          className="win-btn"
          onClick={() => void window.api.minimizeWindow()}
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          className="win-btn"
          onClick={() => void window.api.toggleMaximizeWindow()}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square size={11} />
        </button>
        <button
          className="win-btn close"
          onClick={() => void window.api.closeWindow()}
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Bottom macOS-style Floating Dock */}
      <nav className="bottom-dock no-drag" aria-label="PinSync Toolbar">
        <button className="dock-item" onClick={() => onAddMedia('image')} title="Add Image(s)">
          <span className="dock-icon">
            <ImageIcon size={16} />
          </span>
          <span className="dock-label">Image</span>
        </button>
        <button className="dock-item" onClick={() => onAddMedia('video')} title="Add Video(s)">
          <span className="dock-icon">
            <Video size={16} />
          </span>
          <span className="dock-label">Video</span>
        </button>
        <button className="dock-item" onClick={onAddWebpage} title="Add Webpage (Ctrl+L)">
          <span className="dock-icon">
            <Globe size={16} />
          </span>
          <span className="dock-label">Web</span>
        </button>
        <button className="dock-item" onClick={() => onAddMedia('sound')} title="Add Audio">
          <span className="dock-icon">
            <Music size={16} />
          </span>
          <span className="dock-label">Sound</span>
        </button>
        <button
          className="dock-item"
          onClick={() => onAddMedia('model3d')}
          title="Add 3D Model (GLB, GLTF, OBJ, FBX, STL, STEP, USDZ, ZIP…)"
        >
          <span className="dock-icon">
            <Box size={16} />
          </span>
          <span className="dock-label">3D</span>
        </button>
        <button className="dock-item" onClick={() => onAddMedia('code')} title="Add Code File">
          <span className="dock-icon">
            <Code2 size={16} />
          </span>
          <span className="dock-label">Code</span>
        </button>

        <div className="dock-sep" />

        <button className="dock-item" onClick={onAddText} title="Add Text (or type directly)">
          <span className="dock-icon">
            <Type size={16} />
          </span>
          <span className="dock-label">Text</span>
        </button>

        <button
          className={`dock-item ${drawToolActive ? 'active' : ''}`}
          onClick={onToggleDrawTool}
          title="Free-Draw Pen (Alt+D)"
        >
          <span className="dock-icon">
            <Pencil size={16} />
          </span>
          <span className="dock-label">Draw</span>
        </button>

        <div className="tb-popover-anchor">
          <button
            className={`dock-item ${showFlowShapes ? 'active' : ''}`}
            onClick={() => {
              setShowFlowShapes((s) => !s)
              setShowAppearance(false)
            }}
            title="Flowchart Shapes"
          >
            <span className="dock-icon">
              <Shapes size={16} />
            </span>
            <span className="dock-label">Flow</span>
          </button>
          {showFlowShapes && (
            <div className="tb-popover dock-popover">
              <div className="tb-popover-title">Insert Flowchart Shape</div>
              <div className="tb-popover-grid">
                {(
                  [
                    ['rect', 'Process'],
                    ['rounded', 'Step'],
                    ['diamond', 'Decision'],
                    ['pill', 'Start / End'],
                    ['parallelogram', 'I/O'],
                    ['cylinder', 'Database']
                  ] as [FlowchartShape, string][]
                ).map(([shape, label]) => (
                  <button
                    key={shape}
                    className="ctx-chip"
                    onClick={() => {
                      onAddFlowchart(shape)
                      setShowFlowShapes(false)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          className={`dock-item ${arrowToolActive ? 'active' : ''}`}
          onClick={onToggleArrowTool}
          title="Arrow Tool (Alt+A or type aaa + Space)"
        >
          <span className="dock-icon">
            <ArrowUpRight size={16} />
          </span>
          <span className="dock-label">Arrow</span>
        </button>

        <button
          className="dock-item"
          onClick={onEyedropper}
          title="Screen Color Eyedropper (Alt+I)"
        >
          <span className="dock-icon">
            <Pipette size={16} />
          </span>
          <span className="dock-label">Color</span>
        </button>

        <div className="dock-sep" />

        <button className="dock-icon-btn" onClick={onSearchItems} title="Jump to Item (Ctrl+K)">
          <Search size={15} />
        </button>
        <button
          className="dock-icon-btn"
          onClick={onArrangeOptimal}
          title="Arrange Optimal (Ctrl+P)"
        >
          <LayoutGrid size={15} />
        </button>
        <button className="dock-icon-btn" onClick={onFitView} title="Fit Board in View (Home)">
          <Maximize2 size={15} />
        </button>
        <button
          className={`dock-icon-btn ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title="Toggle Grid"
        >
          <Grid size={15} />
        </button>

        <div className="tb-popover-anchor">
          <button
            className={`dock-icon-btn ${showAppearance ? 'active' : ''}`}
            onClick={() => {
              setShowAppearance((s) => !s)
              setShowFlowShapes(false)
            }}
            title="Canvas Theme & Window Opacity"
          >
            <SlidersHorizontal size={15} />
          </button>
          {showAppearance && (
            <div className="tb-popover dock-popover wide">
              <div className="tb-popover-title">
                <Palette size={12} /> Canvas Theme
              </div>
              <div className="theme-swatches">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-chip ${theme === t.id ? 'active' : ''}`}
                    onClick={() => onChangeTheme(t.id)}
                  >
                    <span className="theme-dot" style={{ background: t.color }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="tb-popover-title" style={{ marginTop: 8 }}>
                Window Opacity ({Math.round(windowOpacity * 100)}%)
              </div>
              <input
                type="range"
                className="media-scrubber"
                style={{ width: '100%' }}
                min={0.3}
                max={1}
                step={0.05}
                value={windowOpacity}
                onChange={(e) => onChangeWindowOpacity(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        <button
          className={`dock-icon-btn ${canvasLocked ? 'active warn' : ''}`}
          onClick={onToggleCanvasLock}
          title="Lock Canvas (Ctrl+R)"
        >
          {canvasLocked ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
        <button
          className={`dock-icon-btn ${alwaysOnTop ? 'active' : ''}`}
          onClick={onToggleAlwaysOnTop}
          title="Always on Top (Ctrl+Shift+A)"
        >
          <Pin size={15} />
        </button>
        <button
          className="dock-icon-btn"
          onClick={onToggleZenMode}
          title="Zen / Minimal Mode (Tab)"
        >
          <EyeOff size={15} />
        </button>

        <div className="dock-sep" />

        <button className="dock-icon-btn" onClick={onNewBoard} title="New / Clear Board (Ctrl+N)">
          <FilePlus2 size={15} />
        </button>
        <button className="dock-icon-btn" onClick={onOpenBoard} title="Open Board (Ctrl+O)">
          <FolderOpen size={15} />
        </button>
        <button
          className="dock-icon-btn"
          onClick={onSaveBoard}
          title="Save Portable Board with Embedded Files (Ctrl+S)"
        >
          <Save size={15} />
        </button>
        <button
          className="dock-icon-btn"
          onClick={onExportPng}
          title="Export Screenshot PNG (Ctrl+E)"
        >
          <Camera size={15} />
        </button>
        <button className="dock-icon-btn" onClick={onShowShortcuts} title="Shortcut Settings (F1)">
          <Keyboard size={15} />
        </button>
        <button
          className={`dock-item ${onlineActive ? 'active online-active' : ''}`}
          onClick={onOpenOnline}
          title="Online Mode & Central Server Sync"
        >
          <span className="dock-icon">
            <Cloud size={16} />
          </span>
          <span className="dock-label">{onlineActive ? 'Live' : 'Online'}</span>
        </button>
      </nav>
    </>
  )
}
