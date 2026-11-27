import React from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Group,
  Magnet,
  Maximize,
  Ruler,
  Ungroup
} from 'lucide-react'
import type { AlignMode } from '../utils/boardMath'

interface StatusBarProps {
  selectedCount: number
  cursorWorld: { x: number; y: number }
  zoom: number
  snapToGrid: boolean
  smartGuides: boolean
  arrowActive: boolean
  canvasLocked: boolean
  onToggleSnapToGrid: () => void
  onToggleSmartGuides: () => void
  onSetZoom: (zoom: number) => void
  onFitView: () => void
  onAlign: (mode: AlignMode) => void
  onDistribute: (axis: 'x' | 'y') => void
  onNormalizeSize: () => void
  onGroup: () => void
  onUngroup: () => void
}

export const StatusBar: React.FC<StatusBarProps> = ({
  selectedCount,
  cursorWorld,
  zoom,
  snapToGrid,
  smartGuides,
  arrowActive,
  canvasLocked,
  onToggleSnapToGrid,
  onToggleSmartGuides,
  onSetZoom,
  onFitView,
  onAlign,
  onDistribute,
  onNormalizeSize,
  onGroup,
  onUngroup
}) => {
  return (
    <footer className="statusbar">
      <div className="sb-left">
        <span className={`sb-mode ${arrowActive ? 'accent' : canvasLocked ? 'warn' : ''}`}>
          {arrowActive ? 'Arrow Draw' : canvasLocked ? 'Canvas Locked' : 'Board Mode'}
        </span>
        <span className="sb-sep">·</span>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : 'No selection'}</span>
        <span className="sb-sep">·</span>
        <span className="sb-coords">
          X:{Math.round(cursorWorld.x)} Y:{Math.round(cursorWorld.y)}
        </span>
      </div>

      {selectedCount >= 2 && (
        <div className="sb-align-bar">
          <button className="sb-icon" onClick={() => onAlign('left')} title="Align Left">
            <AlignStartVertical size={12} />
          </button>
          <button className="sb-icon" onClick={() => onAlign('centerX')} title="Align Center X">
            <AlignCenterVertical size={12} />
          </button>
          <button className="sb-icon" onClick={() => onAlign('right')} title="Align Right">
            <AlignEndVertical size={12} />
          </button>
          <button className="sb-icon" onClick={() => onAlign('top')} title="Align Top">
            <AlignStartHorizontal size={12} />
          </button>
          <button className="sb-icon" onClick={() => onAlign('centerY')} title="Align Middle Y">
            <AlignCenterHorizontal size={12} />
          </button>
          <button className="sb-icon" onClick={() => onAlign('bottom')} title="Align Bottom">
            <AlignEndHorizontal size={12} />
          </button>
          {selectedCount >= 3 && (
            <>
              <button
                className="sb-icon"
                onClick={() => onDistribute('x')}
                title="Distribute Horizontally"
              >
                <AlignHorizontalDistributeCenter size={12} />
              </button>
              <button
                className="sb-icon"
                onClick={() => onDistribute('y')}
                title="Distribute Vertically"
              >
                <AlignVerticalDistributeCenter size={12} />
              </button>
            </>
          )}
          <button
            className="sb-icon"
            onClick={onNormalizeSize}
            title="Normalize Sizes (Ctrl+Alt+Up)"
          >
            <Maximize size={12} />
          </button>
          <button className="sb-icon" onClick={onGroup} title="Group (Ctrl+G)">
            <Group size={12} />
          </button>
          <button className="sb-icon" onClick={onUngroup} title="Ungroup (Ctrl+Shift+G)">
            <Ungroup size={12} />
          </button>
        </div>
      )}

      <div className="sb-right">
        <button
          className={`sb-toggle ${snapToGrid ? 'active' : ''}`}
          onClick={onToggleSnapToGrid}
          title="Snap to Grid"
        >
          <Magnet size={11} /> <span>Snap</span>
        </button>
        <button
          className={`sb-toggle ${smartGuides ? 'active' : ''}`}
          onClick={onToggleSmartGuides}
          title="Smart Alignment Guides"
        >
          <Ruler size={11} /> <span>Guides</span>
        </button>

        <div className="sb-zoom-group">
          <button className="sb-zoom-btn" onClick={() => onSetZoom(0.5)} title="Zoom 50%">
            50%
          </button>
          <button className="sb-zoom-btn" onClick={() => onSetZoom(1)} title="Reset 100% (Ctrl+0)">
            {Math.round(zoom * 100)}%
          </button>
          <button className="sb-zoom-btn" onClick={onFitView} title="Fit Board (Home)">
            Fit
          </button>
        </div>
      </div>
    </footer>
  )
}
