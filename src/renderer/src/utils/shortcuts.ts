export type ShortcutAction =
  | 'paste'
  | 'copy'
  | 'duplicate'
  | 'selectAll'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'arrangeOptimal'
  | 'normalizeSize'
  | 'group'
  | 'ungroup'
  | 'fitView'
  | 'resetZoom'
  | 'alwaysOnTop'
  | 'lockCanvas'
  | 'lockItem'
  | 'flipX'
  | 'flipY'
  | 'resetCrop'
  | 'addWebpage'
  | 'addText'
  | 'arrowTool'
  | 'drawTool'
  | 'addFlowchart'
  | 'eyedropper'
  | 'searchItems'
  | 'zenMode'
  | 'newBoard'
  | 'saveBoard'
  | 'openBoard'
  | 'exportPng'
  | 'bringFront'
  | 'sendBack'
  | 'shortcutSettings'

export interface ShortcutConfig {
  bindings: Record<ShortcutAction, string>
  aaaArrowEnabled: boolean
}

export const SHORTCUT_LABELS: Record<ShortcutAction, { label: string; category: string }> = {
  addText: { label: 'Add Text Box', category: 'Canvas & Creation' },
  arrowTool: { label: 'Start Arrow Tool', category: 'Canvas & Creation' },
  drawTool: { label: 'Toggle Free-Draw Pen', category: 'Canvas & Creation' },
  addFlowchart: { label: 'Add Flowchart Node', category: 'Canvas & Creation' },
  addWebpage: { label: 'Add Webpage URL', category: 'Canvas & Creation' },
  eyedropper: { label: 'Screen Color Eyedropper', category: 'Canvas & Creation' },
  paste: { label: 'Paste (Image / URL / Code / Items)', category: 'Canvas & Creation' },
  copy: { label: 'Copy Selected Items', category: 'Selection & Editing' },
  duplicate: { label: 'Duplicate Selection', category: 'Selection & Editing' },
  selectAll: { label: 'Select All Items', category: 'Selection & Editing' },
  searchItems: { label: 'Quick Jump / Search Items', category: 'Selection & Editing' },
  delete: { label: 'Delete Selection', category: 'Selection & Editing' },
  undo: { label: 'Undo', category: 'Selection & Editing' },
  redo: { label: 'Redo', category: 'Selection & Editing' },
  group: { label: 'Group Selected Items', category: 'Transforms & Layers' },
  ungroup: { label: 'Ungroup Selected Items', category: 'Transforms & Layers' },
  lockItem: { label: 'Lock / Unlock Selected', category: 'Transforms & Layers' },
  flipX: { label: 'Flip Horizontal', category: 'Transforms & Layers' },
  flipY: { label: 'Flip Vertical', category: 'Transforms & Layers' },
  resetCrop: { label: 'Reset Image Crop', category: 'Transforms & Layers' },
  normalizeSize: { label: 'Normalize Selected Sizes', category: 'Transforms & Layers' },
  bringFront: { label: 'Bring to Front', category: 'Transforms & Layers' },
  sendBack: { label: 'Send to Back', category: 'Transforms & Layers' },
  arrangeOptimal: { label: 'Arrange Optimal', category: 'Board & Window' },
  fitView: { label: 'Fit Selection / Board in View', category: 'Board & Window' },
  resetZoom: { label: 'Reset Zoom to 100%', category: 'Board & Window' },
  zenMode: { label: 'Toggle Zen / Minimal Mode', category: 'Board & Window' },
  alwaysOnTop: { label: 'Toggle Always on Top', category: 'Board & Window' },
  lockCanvas: { label: 'Lock / Unlock Canvas', category: 'Board & Window' },
  newBoard: { label: 'New / Clear Board', category: 'Board & Window' },
  openBoard: { label: 'Open Board', category: 'Board & Window' },
  saveBoard: { label: 'Save Board', category: 'Board & Window' },
  exportPng: { label: 'Export Screenshot (PNG)', category: 'Board & Window' },
  shortcutSettings: { label: 'Open Shortcut Settings', category: 'Board & Window' }
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  bindings: {
    addText: 'Ctrl+T',
    arrowTool: 'Alt+A',
    drawTool: 'Alt+D',
    addFlowchart: 'Ctrl+Shift+N',
    addWebpage: 'Ctrl+L',
    eyedropper: 'Alt+I',
    paste: 'Ctrl+V',
    copy: 'Ctrl+C',
    duplicate: 'Ctrl+D',
    selectAll: 'Ctrl+A',
    searchItems: 'Ctrl+K',
    delete: 'Delete',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    group: 'Ctrl+G',
    ungroup: 'Ctrl+Shift+G',
    lockItem: 'Alt+L',
    flipX: 'Alt+Shift+H',
    flipY: 'Alt+Shift+V',
    resetCrop: 'Ctrl+Shift+C',
    normalizeSize: 'Ctrl+Alt+ArrowUp',
    bringFront: ']',
    sendBack: '[',
    arrangeOptimal: 'Ctrl+P',
    fitView: 'Home',
    resetZoom: 'Ctrl+0',
    zenMode: 'Tab',
    alwaysOnTop: 'Ctrl+Shift+A',
    lockCanvas: 'Ctrl+R',
    newBoard: 'Ctrl+N',
    openBoard: 'Ctrl+O',
    saveBoard: 'Ctrl+S',
    exportPng: 'Ctrl+E',
    shortcutSettings: 'F1'
  },
  aaaArrowEnabled: true
}

const STORAGE_KEY = 'refboard.shortcuts.v1'

export function loadShortcutConfig(): ShortcutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SHORTCUTS
    const parsed = JSON.parse(raw) as Partial<ShortcutConfig>
    return {
      bindings: { ...DEFAULT_SHORTCUTS.bindings, ...(parsed.bindings || {}) },
      aaaArrowEnabled: typeof parsed.aaaArrowEnabled === 'boolean' ? parsed.aaaArrowEnabled : true
    }
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

export function saveShortcutConfig(config: ShortcutConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore storage errors
  }
}

function normalizeKeyName(key: string): string {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  if (key === 'Del') return 'Delete'
  return key
}

export function eventToShortcutString(e: KeyboardEvent): string | null {
  const ignored = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS'])
  if (ignored.has(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(normalizeKeyName(e.key))
  return parts.join('+')
}

export function matchesShortcut(e: KeyboardEvent, binding: string): boolean {
  if (!binding) return false
  const pressed = eventToShortcutString(e)
  if (!pressed) return false
  return pressed.toLowerCase() === binding.toLowerCase()
}
