import React from 'react'
import { RotateCw } from 'lucide-react'
import type { BoardItem } from '../types/board'

export type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface TransformGizmoProps {
  item: BoardItem
  zoom: number
  onStartResize: (e: React.MouseEvent, item: BoardItem, dir: HandleDir) => void
  onStartRotate: (e: React.MouseEvent, item: BoardItem) => void
}

const HANDLES: { dir: HandleDir; xPct: string; yPct: string; cursor: string }[] = [
  { dir: 'nw', xPct: '0%', yPct: '0%', cursor: 'nwse-resize' },
  { dir: 'n', xPct: '50%', yPct: '0%', cursor: 'ns-resize' },
  { dir: 'ne', xPct: '100%', yPct: '0%', cursor: 'nesw-resize' },
  { dir: 'e', xPct: '100%', yPct: '50%', cursor: 'ew-resize' },
  { dir: 'se', xPct: '100%', yPct: '100%', cursor: 'nwse-resize' },
  { dir: 's', xPct: '50%', yPct: '100%', cursor: 'ns-resize' },
  { dir: 'sw', xPct: '0%', yPct: '100%', cursor: 'nesw-resize' },
  { dir: 'w', xPct: '0%', yPct: '50%', cursor: 'ew-resize' }
]

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  item,
  zoom,
  onStartResize,
  onStartRotate
}) => {
  if (item.locked) return null

  const invScale = 1 / zoom

  return (
    <div
      className="transform-gizmo"
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`
      }}
    >
      <div
        className="gizmo-rotate-stem"
        style={{
          height: `${24 * invScale}px`,
          top: `${-24 * invScale}px`,
          width: `${Math.max(1, 1.5 * invScale)}px`
        }}
      />

      <button
        type="button"
        className="gizmo-rotate-handle"
        title="Rotate (Ctrl+Drag · Shift to snap)"
        style={{
          top: `${-34 * invScale}px`,
          transform: `translate(-50%, -50%) scale(${invScale})`
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onStartRotate(e, item)
        }}
      >
        <RotateCw size={11} />
      </button>

      {HANDLES.map((h) => (
        <div
          key={h.dir}
          className={`gizmo-handle gizmo-handle-${h.dir}`}
          style={{
            left: h.xPct,
            top: h.yPct,
            cursor: h.cursor,
            transform: `translate(-50%, -50%) scale(${invScale})`
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            onStartResize(e, item, h.dir)
          }}
        />
      ))}
    </div>
  )
}
