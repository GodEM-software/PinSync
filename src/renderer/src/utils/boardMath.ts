import type { BoardItem, ViewportState } from '../types/board'

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function screenToWorld(screenPt: Point, viewport: ViewportState): Point {
  return {
    x: (screenPt.x - viewport.panX) / viewport.zoom,
    y: (screenPt.y - viewport.panY) / viewport.zoom
  }
}

export function worldToScreen(worldPt: Point, viewport: ViewportState): Point {
  return {
    x: worldPt.x * viewport.zoom + viewport.panX,
    y: worldPt.y * viewport.zoom + viewport.panY
  }
}

export function clampZoom(zoom: number): number {
  return Math.min(16, Math.max(0.05, zoom))
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function rotatePoint(pt: Point, angleDeg: number): Point {
  const rad = degToRad(angleDeg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: pt.x * cos - pt.y * sin,
    y: pt.x * sin + pt.y * cos
  }
}

export function getRotatedItemCorners(item: BoardItem): Point[] {
  const hw = item.width / 2
  const hh = item.height / 2
  const localCorners: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh }
  ]
  return localCorners.map((c) => {
    const r = rotatePoint(c, item.rotation)
    return { x: item.x + r.x, y: item.y + r.y }
  })
}

export function getItemWorldAABB(item: BoardItem): Bounds {
  const corners = getRotatedItemCorners(item)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of corners) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function getItemsBounds(items: BoardItem[]): Bounds | null {
  if (items.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    const b = getItemWorldAABB(item)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function aabbIntersects(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/**
 * PureRef-inspired "Arrange Optimal" shelf packer:
 * packs items cleanly into rows around their collective center without overlap.
 */
export function arrangeItemsOptimal(items: BoardItem[], gap = 18): BoardItem[] {
  if (items.length <= 1) return items

  const originalBounds = getItemsBounds(items)
  const centerX = originalBounds ? (originalBounds.minX + originalBounds.maxX) / 2 : 0
  const centerY = originalBounds ? (originalBounds.minY + originalBounds.maxY) / 2 : 0

  // Sort tallest first for clean shelf packing
  const sorted = [...items].sort((a, b) => b.height - a.height)
  const totalArea = sorted.reduce((acc, it) => acc + (it.width + gap) * (it.height + gap), 0)
  const targetRowWidth = Math.max(Math.sqrt(totalArea) * 1.35, sorted[0].width + gap)

  interface Placed {
    id: string
    x: number
    y: number
  }

  const placed: Placed[] = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0
  let maxRowWidth = 0

  for (const item of sorted) {
    if (cursorX > 0 && cursorX + item.width > targetRowWidth) {
      maxRowWidth = Math.max(maxRowWidth, cursorX - gap)
      cursorX = 0
      cursorY += rowHeight + gap
      rowHeight = 0
    }
    placed.push({
      id: item.id,
      x: cursorX + item.width / 2,
      y: cursorY + item.height / 2
    })
    cursorX += item.width + gap
    rowHeight = Math.max(rowHeight, item.height)
  }

  maxRowWidth = Math.max(maxRowWidth, cursorX - gap)
  const totalHeight = cursorY + rowHeight

  const offsetX = centerX - maxRowWidth / 2
  const offsetY = centerY - totalHeight / 2

  const byId = new Map(placed.map((p) => [p.id, p]))
  return items.map((item) => {
    if (item.locked) return item
    const pos = byId.get(item.id)
    if (!pos) return item
    return {
      ...item,
      x: pos.x + offsetX,
      y: pos.y + offsetY,
      rotation: 0
    }
  })
}

export function fitBoundsToViewport(
  bounds: Bounds,
  containerWidth: number,
  containerHeight: number,
  padding = 64
): ViewportState {
  const usableW = Math.max(100, containerWidth - padding * 2)
  const usableH = Math.max(100, containerHeight - padding * 2)
  const zoom = clampZoom(
    Math.min(usableW / Math.max(1, bounds.width), usableH / Math.max(1, bounds.height))
  )
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return {
    zoom,
    panX: containerWidth / 2 - cx * zoom,
    panY: containerHeight / 2 - cy * zoom
  }
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'

export interface AlignmentGuide {
  orientation: 'v' | 'h'
  pos: number
}

export function alignSelectedItems(
  items: BoardItem[],
  selectedIds: string[],
  mode: AlignMode
): BoardItem[] {
  const selSet = new Set(selectedIds)
  const targets = items.filter((it) => selSet.has(it.id) && !it.locked)
  if (targets.length < 2) return items

  const bounds = getItemsBounds(targets)
  if (!bounds) return items
  const midX = (bounds.minX + bounds.maxX) / 2
  const midY = (bounds.minY + bounds.maxY) / 2

  return items.map((it) => {
    if (!selSet.has(it.id) || it.locked) return it
    switch (mode) {
      case 'left':
        return { ...it, x: bounds.minX + it.width / 2 }
      case 'centerX':
        return { ...it, x: midX }
      case 'right':
        return { ...it, x: bounds.maxX - it.width / 2 }
      case 'top':
        return { ...it, y: bounds.minY + it.height / 2 }
      case 'centerY':
        return { ...it, y: midY }
      case 'bottom':
        return { ...it, y: bounds.maxY - it.height / 2 }
    }
  })
}

export function distributeSelectedItems(
  items: BoardItem[],
  selectedIds: string[],
  axis: 'x' | 'y'
): BoardItem[] {
  const selSet = new Set(selectedIds)
  const targets = items.filter((it) => selSet.has(it.id) && !it.locked)
  if (targets.length < 3) return items

  const sorted = [...targets].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalSpan = axis === 'x' ? last.x - first.x : last.y - first.y
  const step = totalSpan / (sorted.length - 1)

  const byId = new Map<string, number>()
  sorted.forEach((it, idx) => {
    byId.set(it.id, (axis === 'x' ? first.x : first.y) + step * idx)
  })

  return items.map((it) => {
    const nextPos = byId.get(it.id)
    if (nextPos === undefined) return it
    return axis === 'x' ? { ...it, x: nextPos } : { ...it, y: nextPos }
  })
}

export function normalizeSelectedSizes(items: BoardItem[], selectedIds: string[]): BoardItem[] {
  const selSet = new Set(selectedIds)
  const targets = items.filter((it) => selSet.has(it.id) && !it.locked)
  if (targets.length < 2) return items

  const avgHeight = Math.max(
    48,
    Math.round(targets.reduce((acc, it) => acc + it.height, 0) / targets.length)
  )

  return items.map((it) => {
    if (!selSet.has(it.id) || it.locked) return it
    const ratio = it.width / Math.max(1, it.height)
    return {
      ...it,
      height: avgHeight,
      width: Math.max(48, Math.round(avgHeight * ratio))
    }
  })
}

export function computeSnapAndGuides(
  primaryItem: BoardItem,
  proposedX: number,
  proposedY: number,
  allItems: BoardItem[],
  movingIds: Set<string>,
  snapGrid: boolean,
  smartGuides: boolean,
  gridSize = 32,
  threshold = 7
): { x: number; y: number; guides: AlignmentGuide[] } {
  let x = proposedX
  let y = proposedY
  const guides: AlignmentGuide[] = []

  if (snapGrid) {
    x = Math.round(x / (gridSize / 2)) * (gridSize / 2)
    y = Math.round(y / (gridSize / 2)) * (gridSize / 2)
  }

  if (!smartGuides) {
    return { x, y, guides }
  }

  const hw = primaryItem.width / 2
  const hh = primaryItem.height / 2

  let bestDx = threshold + 1
  let bestDy = threshold + 1
  let snapGuideX: number | null = null
  let snapGuideY: number | null = null

  const candidatesX = [x - hw, x, x + hw]
  const candidatesY = [y - hh, y, y + hh]

  for (const other of allItems) {
    if (movingIds.has(other.id)) continue
    const ow = other.width / 2
    const oh = other.height / 2
    const targetsX = [other.x - ow, other.x, other.x + ow]
    const targetsY = [other.y - oh, other.y, other.y + oh]

    for (const cx of candidatesX) {
      for (const tx of targetsX) {
        const d = Math.abs(tx - cx)
        if (d < bestDx) {
          bestDx = d
          x = proposedX + (tx - cx)
          snapGuideX = tx
        }
      }
    }

    for (const cy of candidatesY) {
      for (const ty of targetsY) {
        const d = Math.abs(ty - cy)
        if (d < bestDy) {
          bestDy = d
          y = proposedY + (ty - cy)
          snapGuideY = ty
        }
      }
    }
  }

  if (snapGuideX !== null && bestDx <= threshold) {
    guides.push({ orientation: 'v', pos: snapGuideX })
  }
  if (snapGuideY !== null && bestDy <= threshold) {
    guides.push({ orientation: 'h', pos: snapGuideY })
  }

  return { x, y, guides }
}
