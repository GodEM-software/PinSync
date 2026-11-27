import React from 'react'
import type { ArrowItem, ItemRendererProps } from '../types/board'

export const ArrowItemView: React.FC<ItemRendererProps<ArrowItem>> = ({
  item,
  isSelected,
  onUpdate
}) => {
  const sx = item.width / 2 + item.startOffset.x
  const sy = item.height / 2 + item.startOffset.y
  const ex = item.width / 2 + item.endOffset.x
  const ey = item.height / 2 + item.endOffset.y

  const startMarkerId = `arrow-start-${item.id}`
  const endMarkerId = `arrow-end-${item.id}`

  let pathD = `M ${sx} ${sy} L ${ex} ${ey}`
  if (item.routing === 'curved') {
    const mx = (sx + ex) / 2
    const my = (sy + ey) / 2
    const dx = ex - sx
    const dy = ey - sy
    const cx = mx - dy * 0.25
    const cy = my + dx * 0.25
    pathD = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
  } else if (item.routing === 'elbow') {
    const mx = (sx + ex) / 2
    pathD = `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ey} L ${ex} ${ey}`
  }

  const startDragEndpoint =
    (which: 'start' | 'end') =>
    (e: React.MouseEvent): void => {
      e.stopPropagation()
      e.preventDefault()
      const startClientX = e.clientX
      const startClientY = e.clientY
      const origStart = { x: item.x + item.startOffset.x, y: item.y + item.startOffset.y }
      const origEnd = { x: item.x + item.endOffset.x, y: item.y + item.endOffset.y }

      // Infer current board zoom from parent .canvas-world transform if present
      const worldEl = (e.currentTarget as HTMLElement).closest(
        '.canvas-world'
      ) as HTMLElement | null
      let zoom = 1
      if (worldEl) {
        const m = /scale\(([^)]+)\)/.exec(worldEl.style.transform)
        if (m) zoom = parseFloat(m[1]) || 1
      }

      const onMove = (me: MouseEvent): void => {
        const dx = (me.clientX - startClientX) / zoom
        const dy = (me.clientY - startClientY) / zoom
        const p1 = which === 'start' ? { x: origStart.x + dx, y: origStart.y + dy } : origStart
        const p2 = which === 'end' ? { x: origEnd.x + dx, y: origEnd.y + dy } : origEnd

        const cx = (p1.x + p2.x) / 2
        const cy = (p1.y + p2.y) / 2
        const pad = 28
        const width = Math.max(48, Math.abs(p2.x - p1.x) + pad * 2)
        const height = Math.max(48, Math.abs(p2.y - p1.y) + pad * 2)

        onUpdate({
          x: cx,
          y: cy,
          width,
          height,
          rotation: 0,
          startOffset: { x: p1.x - cx, y: p1.y - cy },
          endOffset: { x: p2.x - cx, y: p2.y - cy }
        })
      }

      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }

  return (
    <div className="item-arrow-container">
      <svg className="arrow-svg" width={item.width} height={item.height}>
        <defs>
          {item.startHead === 'arrow' && (
            <marker
              id={startMarkerId}
              viewBox="0 0 10 10"
              refX="2"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={item.color} />
            </marker>
          )}
          {item.startHead === 'dot' && (
            <marker
              id={startMarkerId}
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
            >
              <circle cx="5" cy="5" r="3.5" fill={item.color} />
            </marker>
          )}
          {item.endHead === 'arrow' && (
            <marker
              id={endMarkerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={item.color} />
            </marker>
          )}
          {item.endHead === 'dot' && (
            <marker
              id={endMarkerId}
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
            >
              <circle cx="5" cy="5" r="3.5" fill={item.color} />
            </marker>
          )}
        </defs>

        <path
          d={pathD}
          fill="none"
          stroke={item.color}
          strokeWidth={item.strokeWidth}
          strokeDasharray={item.dashed ? '7 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerStart={item.startHead !== 'none' ? `url(#${startMarkerId})` : undefined}
          markerEnd={item.endHead !== 'none' ? `url(#${endMarkerId})` : undefined}
        />
      </svg>

      {item.label && (
        <div className="arrow-label-pill" style={{ borderColor: item.color }}>
          {item.label}
        </div>
      )}

      {isSelected && !item.locked && (
        <>
          <div
            className="arrow-endpoint-handle"
            style={{ left: sx, top: sy }}
            title="Drag start point"
            onMouseDown={startDragEndpoint('start')}
          />
          <div
            className="arrow-endpoint-handle"
            style={{ left: ex, top: ey }}
            title="Drag end point"
            onMouseDown={startDragEndpoint('end')}
          />
        </>
      )}
    </div>
  )
}
