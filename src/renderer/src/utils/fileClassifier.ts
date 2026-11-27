import type {
  ArrowItem,
  BoardItem,
  CodeItem,
  DrawingItem,
  FlowchartItem,
  FlowchartShape,
  ItemType,
  Model3DFormat,
  TextItem
} from '../types/board'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif', 'ico'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'mkv', 'ogg', 'ogv', 'm4v', 'avi'])
const SOUND_EXTS = new Set(['mp3', 'wav', 'flac', 'm4a', 'aac', 'oga', 'opus'])
const MODEL_EXTS = new Set<string>([
  'glb',
  'gltf',
  'obj',
  'stl',
  'fbx',
  'dae',
  'ply',
  '3ds',
  '3mf',
  'amf',
  'lwo',
  'usd',
  'usda',
  'usdc',
  'usdz',
  'wrl',
  'vrml',
  'vtk',
  'vtp',
  'xyz',
  'pcd',
  'vox',
  'kmz',
  'gcode',
  'off',
  'x3d',
  'bvh',
  'md2',
  'splat',
  'ksplat',
  'spz',
  '3dm',
  'step',
  'stp',
  'iges',
  'igs',
  'brep',
  'zip'
])
const CODE_EXTS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rs',
  'go',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'java',
  'kt',
  'swift',
  'rb',
  'php',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'sql',
  'sh',
  'ps1',
  'md',
  'txt'
])

export function getExtension(pathOrUrl: string): string {
  const clean = pathOrUrl.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  if (dot < 0) return ''
  return clean.slice(dot + 1).toLowerCase()
}

export function getDisplayName(pathOrUrl: string): string {
  const clean = pathOrUrl.split('?')[0].split('#')[0]
  const parts = clean.replace(/\\/g, '/').split('/')
  const last = parts[parts.length - 1]
  if (last) return decodeURIComponent(last)
  try {
    return new URL(pathOrUrl).hostname
  } catch {
    return 'Item'
  }
}

export function toLocalMediaUrl(filePath: string): string {
  if (/^(https?:|data:|blob:|local-media:)/i.test(filePath)) {
    return filePath
  }
  const normalized = filePath.replace(/\\/g, '/')
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  const encoded = withLeadingSlash
    .split('/')
    .map((seg, idx) => (idx === 1 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join('/')
  return `local-media://file${encoded}`
}

export function classifyFileExtension(ext: string): ItemType | null {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (IMAGE_EXTS.has(e)) return 'image'
  if (VIDEO_EXTS.has(e)) return 'video'
  if (SOUND_EXTS.has(e)) return 'sound'
  if (MODEL_EXTS.has(e)) return 'model3d'
  if (CODE_EXTS.has(e)) return 'code'
  return null
}

export function normalizeWebUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

export function looksLikeCode(text: string): boolean {
  const lines = text.split(/\r?\n/)
  if (lines.length >= 2) {
    if (
      /(^|\s)(import|export|const|let|var|function|class|def|fn|pub|struct|impl|interface|type|return|SELECT|FROM|WHERE|#include|using|package)\b/m.test(
        text
      )
    ) {
      return true
    }
    if (/[{};()=>[\]]/.test(text) && /\n\s{2,}/.test(text)) {
      return true
    }
  }
  return false
}

export function makeId(): string {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createBoardItemFromFile(
  filePath: string,
  x: number,
  y: number,
  zIndex: number,
  textContent?: string | null
): BoardItem | null {
  const ext = getExtension(filePath)
  const type = classifyFileExtension(ext)
  if (!type) return null

  const src = toLocalMediaUrl(filePath)
  const name = getDisplayName(filePath)
  const base = {
    id: makeId(),
    name,
    x,
    y,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false
  }

  switch (type) {
    case 'image':
      return {
        ...base,
        type: 'image',
        src,
        width: 340,
        height: 260,
        grayscale: false
      }
    case 'video':
      return {
        ...base,
        type: 'video',
        src,
        width: 420,
        height: 260,
        loop: true,
        muted: false,
        volume: 0.8,
        playbackRate: 1
      }
    case 'sound':
      return {
        ...base,
        type: 'sound',
        src,
        width: 320,
        height: 148,
        loop: false,
        volume: 0.85
      }
    case 'model3d':
      return {
        ...base,
        type: 'model3d',
        src,
        filePath,
        format: (ext as Model3DFormat) || 'glb',
        width: 360,
        height: 320,
        wireframe: false,
        showGrid: true,
        autoRotate: false
      }
    case 'code':
      return createCodeItem(textContent || `// ${name}`, ext || 'txt', x, y, zIndex, name, filePath)
    default:
      return null
  }
}

export function createImageItemFromDataUrl(
  dataUrl: string,
  x: number,
  y: number,
  zIndex: number,
  width = 340,
  height = 260,
  name = 'Pasted Image'
): BoardItem {
  const maxDim = 480
  let w = width
  let h = height
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  return {
    id: makeId(),
    type: 'image',
    name,
    src: dataUrl,
    x,
    y,
    width: Math.max(80, w),
    height: Math.max(80, h),
    naturalWidth: width,
    naturalHeight: height,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    grayscale: false
  }
}

export function createWebpageItem(url: string, x: number, y: number, zIndex: number): BoardItem {
  const normalized = normalizeWebUrl(url) || 'https://example.com'
  let name = normalized
  try {
    name = new URL(normalized).hostname
  } catch {
    // keep raw
  }
  return {
    id: makeId(),
    type: 'webpage',
    name,
    url: normalized,
    x,
    y,
    width: 540,
    height: 400,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    zoomFactor: 1
  }
}

export function createTextItem(x: number, y: number, zIndex: number, initialText = ''): TextItem {
  return {
    id: makeId(),
    type: 'text',
    name: 'Text',
    x,
    y,
    width: 240,
    height: 64,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    text: initialText,
    fontSize: 18,
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#f1f5f9',
    backgroundColor: 'rgba(28, 31, 39, 0.72)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 6
  }
}

export function createFlowchartItem(
  shape: FlowchartShape,
  x: number,
  y: number,
  zIndex: number,
  label = 'Step'
): FlowchartItem {
  const defaultSizes: Record<FlowchartShape, { w: number; h: number }> = {
    rect: { w: 180, h: 84 },
    rounded: { w: 180, h: 80 },
    diamond: { w: 150, h: 120 },
    pill: { w: 170, h: 68 },
    parallelogram: { w: 190, h: 80 },
    cylinder: { w: 150, h: 110 }
  }
  const sz = defaultSizes[shape]
  return {
    id: makeId(),
    type: 'flowchart',
    name: `Flowchart (${shape})`,
    x,
    y,
    width: sz.w,
    height: sz.h,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    shape,
    label,
    fontSize: 14,
    fillColor: '#232836',
    borderColor: '#60a5fa',
    textColor: '#f8fafc'
  }
}

export function createArrowItem(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zIndex: number
): ArrowItem {
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const pad = 28
  const width = Math.max(48, Math.abs(dx) + pad * 2)
  const height = Math.max(48, Math.abs(dy) + pad * 2)

  return {
    id: makeId(),
    type: 'arrow',
    name: 'Arrow',
    x: cx,
    y: cy,
    width,
    height,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    startOffset: { x: x1 - cx, y: y1 - cy },
    endOffset: { x: x2 - cx, y: y2 - cy },
    color: '#60a5fa',
    strokeWidth: 2.5,
    dashed: false,
    routing: 'straight',
    startHead: 'none',
    endHead: 'arrow'
  }
}

export function createCodeItem(
  code: string,
  language: string,
  x: number,
  y: number,
  zIndex: number,
  name = 'Code Snippet',
  filePath?: string
): CodeItem {
  const lineCount = code.split(/\r?\n/).length
  const height = Math.min(460, Math.max(140, lineCount * 20 + 54))
  return {
    id: makeId(),
    type: 'code',
    name,
    x,
    y,
    width: 440,
    height,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    code,
    language: language || 'txt',
    filePath,
    fontSize: 12.5,
    showLineNumbers: true,
    wordWrap: false
  }
}

export function createDrawingItem(
  points: Array<{ x: number; y: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  color = '#f1f5f9',
  strokeWidth = 3
): DrawingItem {
  return {
    id: makeId(),
    type: 'drawing',
    name: 'Drawing',
    x,
    y,
    width: Math.max(16, width),
    height: Math.max(16, height),
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    points,
    color,
    strokeWidth,
    smoothing: true
  }
}

export function createSwatchItem(
  hex: string,
  x: number,
  y: number,
  zIndex: number,
  label?: string
): Extract<BoardItem, { type: 'swatch' }> {
  const cleanHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`
  return {
    id: makeId(),
    type: 'swatch',
    name: cleanHex,
    x,
    y,
    width: 156,
    height: 112,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    flipX: false,
    flipY: false,
    hex: cleanHex,
    label
  }
}
