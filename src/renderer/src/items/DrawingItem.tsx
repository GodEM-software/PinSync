import React, { useMemo } from 'react'
import type { DrawingItem, ItemRendererProps } from '../types/board'

// Smooth the raw points array using Chaikin curve refinement
function chaikin(
  pts: Array<{ x: number; y: number }>,
  iterations = 2
): Array<{ x: number; y: number }> {
  let result = pts
  for (let it = 0; it < iterations; it++) {
    const next: Array<{ x: number; y: number }> = [result[0]]
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i]
      const p1 = result[i + 1]
      next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y })
      next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y })
    }
    next.push(result[result.length - 1])
    result = next
  }
  return result
}

function pointsToSvgPath(pts: Array<{ x: number; y: number }>, smooth: boolean): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.5} ${pts[0].y}`

  const src = smooth && pts.length > 3 ? chaikin(pts, 2) : pts

  let d = `M ${src[0].x.toFixed(2)} ${src[0].y.toFixed(2)}`
  for (let i = 1; i < src.length; i++) {
    d += ` L ${src[i].x.toFixed(2)} ${src[i].y.toFixed(2)}`
  }
  return d
}

export const DrawingItemView: React.FC<ItemRendererProps<DrawingItem>> = ({ item }) => {
  // Translate points to be local to the item bounding box
  const { d, vw, vh } = useMemo(() => {
    if (item.points.length === 0) return { d: '', vw: item.width, vh: item.height }

    const xs = item.points.map((p) => p.x)
    const ys = item.points.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)

    const local = item.points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
    const pathStr = pointsToSvgPath(local, item.smoothing)

    return { d: pathStr, vw: item.width, vh: item.height }
  }, [item.points, item.smoothing, item.width, item.height])

  return (
    <svg
      width={vw}
      height={vh}
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ display: 'block', overflow: 'visible', width: '100%', height: '100%' }}
      preserveAspectRatio="none"
    >
      {d && (
        <path
          d={d}
          fill="none"
          stroke={item.color}
          strokeWidth={item.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={item.opacity}
        />
      )}
    </svg>
  )
}
