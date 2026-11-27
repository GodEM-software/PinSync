export type ItemType =
  | 'image'
  | 'video'
  | 'webpage'
  | 'sound'
  | 'model3d'
  | 'text'
  | 'flowchart'
  | 'arrow'
  | 'code'
  | 'swatch'
  | 'drawing'

export type Model3DFormat =
  | 'glb'
  | 'gltf'
  | 'obj'
  | 'stl'
  | 'fbx'
  | 'dae'
  | 'ply'
  | '3ds'
  | '3mf'
  | 'amf'
  | 'lwo'
  | 'usd'
  | 'usda'
  | 'usdc'
  | 'usdz'
  | 'wrl'
  | 'vrml'
  | 'vtk'
  | 'vtp'
  | 'xyz'
  | 'pcd'
  | 'vox'
  | 'kmz'
  | 'gcode'
  | 'off'
  | 'x3d'
  | 'bvh'
  | 'md2'
  | 'splat'
  | 'ksplat'
  | 'spz'
  | '3dm'
  | 'step'
  | 'stp'
  | 'iges'
  | 'igs'
  | 'brep'
  | 'zip'

export type FlowchartShape = 'rect' | 'rounded' | 'diamond' | 'pill' | 'parallelogram' | 'cylinder'

export type ArrowRouting = 'straight' | 'curved' | 'elbow'
export type ArrowHeadStyle = 'none' | 'arrow' | 'dot'

export interface CropRect {
  left: number // 0..1 normalized inset
  top: number
  right: number
  bottom: number
}

export interface BaseBoardItem {
  id: string
  type: ItemType
  name: string
  x: number // center x in world coordinates
  y: number // center y in world coordinates
  width: number
  height: number
  rotation: number // degrees
  zIndex: number
  opacity: number // 0.1..1
  locked: boolean
  flipX: boolean
  flipY: boolean
  groupId?: string
  embeddedAssetId?: string
  serverAssetId?: string
}

export interface ImageItem extends BaseBoardItem {
  type: 'image'
  src: string
  naturalWidth?: number
  naturalHeight?: number
  grayscale?: boolean
  crop?: CropRect
}

export interface VideoItem extends BaseBoardItem {
  type: 'video'
  src: string
  loop: boolean
  muted: boolean
  volume: number
  playbackRate: number
}

export interface WebpageItem extends BaseBoardItem {
  type: 'webpage'
  url: string
  zoomFactor?: number
}

export interface SoundItem extends BaseBoardItem {
  type: 'sound'
  src: string
  loop: boolean
  volume: number
}

export interface Model3DItem extends BaseBoardItem {
  type: 'model3d'
  src: string
  filePath?: string
  format: Model3DFormat
  wireframe: boolean
  showGrid: boolean
  autoRotate: boolean
  backgroundColor?: string
}

export interface TextItem extends BaseBoardItem {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  textAlign: 'left' | 'center' | 'right'
  color: string
  backgroundColor: string
  borderColor: string
  borderRadius: number
}

export interface FlowchartItem extends BaseBoardItem {
  type: 'flowchart'
  shape: FlowchartShape
  label: string
  fontSize: number
  fillColor: string
  borderColor: string
  textColor: string
}

export interface ArrowItem extends BaseBoardItem {
  type: 'arrow'
  // Offsets relative to center (x, y)
  startOffset: { x: number; y: number }
  endOffset: { x: number; y: number }
  color: string
  strokeWidth: number
  dashed: boolean
  routing: ArrowRouting
  startHead: ArrowHeadStyle
  endHead: ArrowHeadStyle
  label?: string
}

export interface CodeItem extends BaseBoardItem {
  type: 'code'
  code: string
  language: string
  filePath?: string
  fontSize: number
  showLineNumbers: boolean
  wordWrap: boolean
}

export interface SwatchItem extends BaseBoardItem {
  type: 'swatch'
  hex: string
  label?: string
}

export interface DrawingItem extends BaseBoardItem {
  type: 'drawing'
  points: Array<{ x: number; y: number }>
  color: string
  strokeWidth: number
  opacity: number
  smoothing: boolean
}

export type BoardItem =
  | ImageItem
  | VideoItem
  | WebpageItem
  | SoundItem
  | Model3DItem
  | TextItem
  | FlowchartItem
  | ArrowItem
  | CodeItem
  | SwatchItem
  | DrawingItem

export type BoardTheme = 'charcoal' | 'obsidian' | 'neutral' | 'slate' | 'blueprint'

export interface ViewportState {
  panX: number
  panY: number
  zoom: number
}

export interface EmbeddedAsset {
  fileName: string
  mimeType: string
  dataBase64: string
}

export interface BoardDocument {
  version: 1
  name: string
  theme?: BoardTheme
  viewport: ViewportState
  items: BoardItem[]
  assets?: Record<string, EmbeddedAsset>
}

export interface ItemRendererProps<T extends BoardItem = BoardItem> {
  item: T
  isSelected: boolean
  isInteractive: boolean
  onUpdate: (patch: Partial<T>) => void
  onRequestInteract: () => void
  onFinishInteract?: () => void
  onTriggerArrowFromText?: () => void
}
