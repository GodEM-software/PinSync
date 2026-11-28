import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  protocol,
  dialog,
  clipboard,
  nativeImage,
  screen,
  session
} from 'electron'
import { join, extname, normalize, basename } from 'path'
import fs from 'fs'
import os from 'os'
import http from 'http'
import crypto from 'crypto'
import { Readable } from 'stream'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Register local-media:// before app is ready so fetch, <video>, <audio>, <img>, and Three.js loaders work seamlessly.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.stl': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.dae': 'model/vnd.collada+xml',
  '.ply': 'application/octet-stream',
  '.3ds': 'application/octet-stream',
  '.3mf': 'model/3mf',
  '.amf': 'application/xml',
  '.lwo': 'application/octet-stream',
  '.usd': 'application/octet-stream',
  '.usda': 'text/plain; charset=utf-8',
  '.usdc': 'application/octet-stream',
  '.usdz': 'model/vnd.usdz+zip',
  '.wrl': 'model/vrml',
  '.vrml': 'model/vrml',
  '.vtk': 'application/octet-stream',
  '.vtp': 'application/xml',
  '.xyz': 'text/plain; charset=utf-8',
  '.pcd': 'application/octet-stream',
  '.vox': 'application/octet-stream',
  '.kmz': 'application/vnd.google-earth.kmz',
  '.gcode': 'text/plain; charset=utf-8',
  '.off': 'text/plain; charset=utf-8',
  '.x3d': 'model/x3d+xml',
  '.bvh': 'text/plain; charset=utf-8',
  '.md2': 'application/octet-stream',
  '.splat': 'application/octet-stream',
  '.ksplat': 'application/octet-stream',
  '.spz': 'application/octet-stream',
  '.3dm': 'application/octet-stream',
  '.step': 'application/step',
  '.stp': 'application/step',
  '.iges': 'model/iges',
  '.igs': 'model/iges',
  '.brep': 'application/octet-stream',
  '.zip': 'application/zip',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm'
}

function resolveLocalMediaPath(requestUrl: string): string | null {
  try {
    const parsed = new URL(requestUrl)
    if (parsed.hostname === 'three-libs') {
      const rel = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
      const candidate = normalize(
        join(app.getAppPath(), 'node_modules/three/examples/jsm/libs', rel)
      )
      return candidate
    }
    let rawPath = decodeURIComponent(parsed.pathname)
    // local-media://file/F:/folder/item.png -> /F:/folder/item.png -> F:/folder/item.png
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(rawPath)) {
      rawPath = rawPath.slice(1)
    }
    return normalize(rawPath)
  } catch {
    return null
  }
}

function registerLocalMediaProtocol(): void {
  protocol.handle('local-media', async (request) => {
    const filePath = resolveLocalMediaPath(request.url)
    if (!filePath || !fs.existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    const stat = fs.statSync(filePath)
    if (!stat.isFile()) {
      return new Response('Not a file', { status: 404 })
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const fileSize = stat.size
    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1
        if (start >= fileSize || start > end) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` }
          })
        }
        const chunkSize = end - start + 1
        const nodeStream = fs.createReadStream(filePath, { start, end })
        const webStream = Readable.toWeb(nodeStream) as ReadableStream
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType
          }
        })
      }
    }

    const nodeStream = fs.createReadStream(filePath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream
    return new Response(webStream, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Content-Type': contentType
      }
    })
  })
}

let mainWindow: BrowserWindow | null = null
let dragOrigin: {
  cursorX: number
  cursorY: number
  winX: number
  winY: number
  width: number
  height: number
} | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 460,
    minHeight: 340,
    center: true,
    show: true,
    frame: false,
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.webContents.on('did-fail-load', (_, code, desc) => {
    console.error('did-fail-load:', code, desc)
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('render-process-gone:', details)
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize-toggle', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return false
    } else {
      mainWindow.maximize()
      return true
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:set-always-on-top', (_, flag: boolean) => {
    if (!mainWindow) return false
    mainWindow.setAlwaysOnTop(flag, 'floating')
    return mainWindow.isAlwaysOnTop()
  })

  ipcMain.handle('window:set-opacity', (_, opacity: number) => {
    if (!mainWindow) return 1
    const clamped = Math.min(1, Math.max(0.25, opacity))
    mainWindow.setOpacity(clamped)
    return clamped
  })

  ipcMain.on('window:drag-start', () => {
    if (!mainWindow || mainWindow.isMaximized()) {
      dragOrigin = null
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = mainWindow.getBounds()
    dragOrigin = {
      cursorX: cursor.x,
      cursorY: cursor.y,
      winX: bounds.x,
      winY: bounds.y,
      width: bounds.width,
      height: bounds.height
    }
  })

  ipcMain.on('window:drag-move', () => {
    if (!mainWindow || !dragOrigin || mainWindow.isMaximized()) return
    const cursor = screen.getCursorScreenPoint()
    const dx = cursor.x - dragOrigin.cursorX
    const dy = cursor.y - dragOrigin.cursorY
    mainWindow.setBounds({
      x: dragOrigin.winX + dx,
      y: dragOrigin.winY + dy,
      width: dragOrigin.width,
      height: dragOrigin.height
    })
  })

  ipcMain.on('window:drag-end', () => {
    dragOrigin = null
  })

  ipcMain.handle(
    'dialog:open-files',
    async (_, kind?: 'all' | 'image' | 'video' | 'sound' | 'model3d' | 'code') => {
      if (!mainWindow) return []

      const modelExts = [
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
      ]

      const codeExts = [
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
      ]

      const filterMap: Record<string, Electron.FileFilter[]> = {
        image: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']
          }
        ],
        video: [
          { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv', 'ogg', 'ogv', 'm4v', 'avi'] }
        ],
        sound: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'] }],
        model3d: [
          { name: '3D Models & CAD', extensions: modelExts },
          { name: 'All Files', extensions: ['*'] }
        ],
        code: [{ name: 'Code & Text Files', extensions: codeExts }],
        all: [
          {
            name: 'All Reference Media & Code',
            extensions: [
              'png',
              'jpg',
              'jpeg',
              'webp',
              'gif',
              'bmp',
              'svg',
              'avif',
              'mp4',
              'webm',
              'mov',
              'mkv',
              'ogg',
              'ogv',
              'm4v',
              'mp3',
              'wav',
              'flac',
              'm4a',
              'aac',
              'opus',
              ...modelExts,
              ...codeExts
            ]
          },
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']
          },
          { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv', 'ogg', 'ogv', 'm4v'] },
          { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'] },
          { name: '3D Models', extensions: modelExts },
          { name: 'Code & Text', extensions: codeExts }
        ]
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Add Reference Items',
        properties: ['openFile', 'multiSelections'],
        filters: filterMap[kind || 'all']
      })

      if (result.canceled) return []
      return result.filePaths
    }
  )

  ipcMain.handle('fs:read-text-file', async (_, filePath: string) => {
    try {
      const normalized = normalize(filePath)
      const stat = await fs.promises.stat(normalized)
      if (!stat.isFile()) return null
      // Cap read at 256 KB so dropping huge files never stalls the renderer
      const maxBytes = 256 * 1024
      const handle = await fs.promises.open(normalized, 'r')
      try {
        const readLen = Math.min(stat.size, maxBytes)
        const buffer = Buffer.alloc(readLen)
        await handle.read(buffer, 0, readLen, 0)
        let text = buffer.toString('utf-8')
        if (stat.size > maxBytes) {
          text += '\n\n/* ... truncated at 256 KB for smooth canvas performance ... */'
        }
        return text
      } finally {
        await handle.close()
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('cad:parse-file', async (_, filePath: string) => {
    try {
      const normalized = normalize(filePath)
      const ext = extname(normalized).toLowerCase()
      const fileContent = await fs.promises.readFile(normalized)
      // Dynamic require so occt-import-js WASM loads only when a STEP/IGES/BREP file is imported
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const occtInit = require('occt-import-js')
      const occt = await occtInit()
      if (ext === '.igs' || ext === '.iges') {
        return occt.ReadIgesFile(fileContent, null)
      }
      if (ext === '.brep') {
        return occt.ReadBrepFile(fileContent, null)
      }
      return occt.ReadStepFile(fileContent, null)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to parse CAD file'
      }
    }
  })

  ipcMain.handle('board:save', async (_, payload: { filePath?: string; content: string }) => {
    if (!mainWindow) return null
    let targetPath = payload.filePath
    if (!targetPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save PinSync Board',
        defaultPath: 'reference-board.artbrd.json',
        filters: [{ name: 'PinSync Files', extensions: ['artbrd.json', 'json'] }]
      })
      if (result.canceled || !result.filePath) return null
      targetPath = result.filePath
    }

    // Bundle all local media sources directly into the saved file so it is portable across computers
    let outputContent = payload.content
    try {
      const doc = JSON.parse(payload.content) as {
        items?: Array<Record<string, unknown>>
        assets?: Record<string, { fileName: string; mimeType: string; dataBase64: string }>
      }
      if (Array.isArray(doc.items)) {
        const nextAssets: Record<
          string,
          { fileName: string; mimeType: string; dataBase64: string }
        > = { ...(doc.assets || {}) }

        for (const item of doc.items) {
          const src = typeof item.src === 'string' ? item.src : ''
          const filePathProp = typeof item.filePath === 'string' ? item.filePath : ''
          let localPath: string | null = null
          if (src.startsWith('local-media://file/')) {
            localPath = resolveLocalMediaPath(src)
          } else if (filePathProp) {
            localPath = normalize(filePathProp)
          }

          if (localPath && fs.existsSync(localPath)) {
            const stat = fs.statSync(localPath)
            // Embed files up to 150 MB
            if (stat.isFile() && stat.size <= 150 * 1024 * 1024) {
              const buf = fs.readFileSync(localPath)
              const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)
              const ext = extname(localPath).toLowerCase()
              const fileName = `${hash}_${basename(localPath)}`
              const assetId = `asset_${hash}`
              if (!nextAssets[assetId]) {
                nextAssets[assetId] = {
                  fileName,
                  mimeType: MIME_TYPES[ext] || 'application/octet-stream',
                  dataBase64: buf.toString('base64')
                }
              }
              item.embeddedAssetId = assetId
            }
          }
        }
        doc.assets = nextAssets
        outputContent = JSON.stringify(doc, null, 2)
      }
    } catch {
      // Fallback to raw content if JSON parse fails
    }

    fs.writeFileSync(targetPath, outputContent, 'utf-8')
    return targetPath
  })

  ipcMain.handle('board:open', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open PinSync Board',
      properties: ['openFile'],
      filters: [{ name: 'PinSync Files', extensions: ['json', 'artbrd'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    let content = fs.readFileSync(filePath, 'utf-8')

    // Extract embedded assets if the original local paths do not exist on this computer
    try {
      const doc = JSON.parse(content) as {
        items?: Array<Record<string, unknown>>
        assets?: Record<string, { fileName: string; mimeType: string; dataBase64: string }>
      }
      if (doc.assets && Array.isArray(doc.items)) {
        const assetDir = join(app.getPath('userData'), 'imported-assets')
        fs.mkdirSync(assetDir, { recursive: true })
        const extractedPaths = new Map<string, string>()

        for (const [assetId, asset] of Object.entries(doc.assets)) {
          if (!asset?.dataBase64 || !asset.fileName) continue
          const safeName = asset.fileName.replace(/[<>:"/\\|?*]/g, '_')
          const destPath = join(assetDir, safeName)
          if (!fs.existsSync(destPath)) {
            fs.writeFileSync(destPath, Buffer.from(asset.dataBase64, 'base64'))
          }
          extractedPaths.set(assetId, destPath)
        }

        for (const item of doc.items) {
          const assetId = typeof item.embeddedAssetId === 'string' ? item.embeddedAssetId : ''
          if (!assetId) continue
          const extracted = extractedPaths.get(assetId)
          if (!extracted) continue

          const src = typeof item.src === 'string' ? item.src : ''
          const resolvedOrig = src.startsWith('local-media://file/')
            ? resolveLocalMediaPath(src)
            : null
          const origExists = Boolean(resolvedOrig && fs.existsSync(resolvedOrig))

          if (!origExists) {
            const normalized = extracted.replace(/\\/g, '/')
            const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
            const encoded = withLeadingSlash
              .split('/')
              .map((seg, idx) =>
                idx === 1 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)
              )
              .join('/')
            item.src = `local-media://file${encoded}`
            if (typeof item.filePath === 'string' || item.type === 'model3d') {
              item.filePath = extracted
            }
          }
        }
        content = JSON.stringify(doc)
      }
    } catch {
      // Ignore asset extraction errors and return raw file content
    }

    return { filePath, content }
  })

  ipcMain.handle('board:autosave-save', async (_, content: string) => {
    try {
      const target = join(app.getPath('userData'), 'autosave.artbrd.json')
      await fs.promises.writeFile(target, content, 'utf-8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('board:autosave-load', async () => {
    try {
      const target = join(app.getPath('userData'), 'autosave.artbrd.json')
      if (!fs.existsSync(target)) return null
      return await fs.promises.readFile(target, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('board:export-png', async () => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Board Screenshot',
      defaultPath: 'reference-board.png',
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const image = await mainWindow.webContents.capturePage()
    await fs.promises.writeFile(result.filePath, image.toPNG())
    return result.filePath
  })

  ipcMain.handle('clipboard:read', async () => {
    try {
      const items = await clipboard.read()
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'))
        if (imgType) {
          const blob = await item.getType(imgType)
          if (blob instanceof Blob) {
            const buf = Buffer.from(await blob.arrayBuffer())
            const img = nativeImage.createFromBuffer(buf)
            const size = img.getSize()
            return {
              kind: 'image' as const,
              dataUrl: `data:${imgType};base64,${buf.toString('base64')}`,
              width: size.width,
              height: size.height
            }
          }
        }
      }
    } catch {
      // fall through to text
    }

    try {
      const text = (await clipboard.readText()).trim()
      if (text) {
        return {
          kind: 'text' as const,
          text
        }
      }
    } catch {
      // empty clipboard
    }
    return null
  })

  ipcMain.handle('shell:open-external', (_, url: string) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }
  })

  // Native OS Drag-Out: drag any item out of VisualDock to Explorer, Desktop, Photoshop, Blender, etc.
  ipcMain.on(
    'item:native-drag-out',
    (
      event,
      payload: {
        type: string
        name?: string
        src?: string
        filePath?: string
        textContent?: string
        svgContent?: string
      }
    ) => {
      try {
        let targetPath: string | null = null
        const dragDir = join(app.getPath('temp'), 'pinsync-drag')
        fs.mkdirSync(dragDir, { recursive: true })
        const safeBase = (payload.name || payload.type || 'item').replace(/[<>:"/\\|?*]/g, '_')

        if (payload.filePath && fs.existsSync(payload.filePath)) {
          targetPath = normalize(payload.filePath)
        } else if (payload.src?.startsWith('local-media://file/')) {
          const resolved = resolveLocalMediaPath(payload.src)
          if (resolved && fs.existsSync(resolved)) {
            targetPath = resolved
          }
        } else if (payload.src?.startsWith('data:image/')) {
          const m = /^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/.exec(payload.src)
          if (m) {
            const ext = m[1] === 'jpeg' ? 'jpg' : m[1].replace('+xml', '')
            const out = join(dragDir, `${safeBase}.${ext}`)
            fs.writeFileSync(out, Buffer.from(m[2], 'base64'))
            targetPath = out
          }
        } else if (payload.svgContent) {
          const out = join(dragDir, `${safeBase}.svg`)
          fs.writeFileSync(out, payload.svgContent, 'utf-8')
          targetPath = out
        } else if (payload.textContent !== undefined) {
          const ext = extname(safeBase) ? '' : '.txt'
          const out = join(dragDir, `${safeBase}${ext}`)
          fs.writeFileSync(out, payload.textContent, 'utf-8')
          targetPath = out
        }

        if (!targetPath || !fs.existsSync(targetPath)) return

        let dragIcon = nativeImage.createFromPath(icon)
        if (payload.type === 'image') {
          const img = nativeImage.createFromPath(targetPath)
          if (!img.isEmpty()) {
            dragIcon = img.resize({ width: 64, height: 64, quality: 'good' })
          }
        } else if (!dragIcon.isEmpty()) {
          dragIcon = dragIcon.resize({ width: 48, height: 48 })
        }

        event.sender.startDrag({
          file: targetPath,
          icon: dragIcon
        })
      } catch {
        // ignore drag-out errors
      }
    }
  )

  // Central Server host & Online asset sync
  let localCentralServer: http.Server | null = null
  let localCentralPort = 4580

  function getLanUrls(port: number): string[] {
    const urls = [`http://127.0.0.1:${port}`]
    const ifaces = os.networkInterfaces()
    for (const entries of Object.values(ifaces)) {
      if (!entries) continue
      for (const info of entries) {
        if (info.family === 'IPv4' && !info.internal) {
          urls.push(`http://${info.address}:${port}`)
        }
      }
    }
    return urls
  }

  ipcMain.handle('server:status', () => ({
    running: Boolean(localCentralServer),
    port: localCentralPort,
    urls: localCentralServer ? getLanUrls(localCentralPort) : []
  }))

  ipcMain.handle('server:start', async (_, port = 4580) => {
    if (localCentralServer) {
      return { running: true, port: localCentralPort, urls: getLanUrls(localCentralPort) }
    }
    const unpackedPath = join(
      app.getAppPath().replace(/app\.asar$/i, 'app.asar.unpacked'),
      'server/central-server.mjs'
    )
    const serverModPath = fs.existsSync(unpackedPath)
      ? unpackedPath
      : join(app.getAppPath(), 'server/central-server.mjs')
    const { createCentralServer } = await import(
      /* @vite-ignore */ `file:///${serverModPath.replace(/\\/g, '/')}`
    )
    const dataDir = join(app.getPath('userData'), 'central-server-data')
    const srv = createCentralServer(dataDir) as http.Server
    await new Promise<void>((resolve, reject) => {
      srv.once('error', reject)
      srv.listen(port, '0.0.0.0', () => resolve())
    })
    localCentralServer = srv
    localCentralPort = port
    return { running: true, port, urls: getLanUrls(port) }
  })

  ipcMain.handle('server:stop', async () => {
    if (!localCentralServer) return { running: false, port: localCentralPort, urls: [] }
    const srv = localCentralServer
    localCentralServer = null
    await new Promise<void>((resolve) => srv.close(() => resolve()))
    return { running: false, port: localCentralPort, urls: [] }
  })

  ipcMain.handle(
    'online:sync-assets-up',
    async (_, payload: { serverUrl: string; items: Array<Record<string, unknown>> }) => {
      const baseUrl = payload.serverUrl.replace(/\/+$/, '')
      const updatedItems = await Promise.all(
        payload.items.map(async (item) => {
          if (typeof item.serverAssetId === 'string' && item.serverAssetId) {
            return item
          }
          const src = typeof item.src === 'string' ? item.src : ''
          const filePathProp = typeof item.filePath === 'string' ? item.filePath : ''
          let localPath: string | null = null
          if (src.startsWith('local-media://file/')) {
            localPath = resolveLocalMediaPath(src)
          } else if (filePathProp) {
            localPath = normalize(filePathProp)
          }
          if (!localPath || !fs.existsSync(localPath)) return item
          const stat = fs.statSync(localPath)
          if (!stat.isFile() || stat.size > 150 * 1024 * 1024) return item

          const buf = fs.readFileSync(localPath)
          const ext = extname(localPath).toLowerCase()
          const resp = await fetch(`${baseUrl}/api/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: basename(localPath),
              mimeType: MIME_TYPES[ext] || 'application/octet-stream',
              dataBase64: buf.toString('base64')
            })
          })
          if (!resp.ok) return item
          const data = (await resp.json()) as { assetId: string }
          return { ...item, serverAssetId: data.assetId }
        })
      )
      return updatedItems
    }
  )

  ipcMain.handle(
    'online:sync-assets-down',
    async (_, payload: { serverUrl: string; items: Array<Record<string, unknown>> }) => {
      const baseUrl = payload.serverUrl.replace(/\/+$/, '')
      const cacheDir = join(app.getPath('userData'), 'online-cache')
      fs.mkdirSync(cacheDir, { recursive: true })

      const updatedItems = await Promise.all(
        payload.items.map(async (item) => {
          const assetId = typeof item.serverAssetId === 'string' ? item.serverAssetId : ''
          if (!assetId) return item

          const src = typeof item.src === 'string' ? item.src : ''
          const origLocal = src.startsWith('local-media://file/')
            ? resolveLocalMediaPath(src)
            : null
          if (origLocal && fs.existsSync(origLocal)) {
            return item
          }

          const safeId = assetId.replace(/[^a-zA-Z0-9._-]/g, '_')
          const destPath = join(cacheDir, safeId)
          if (!fs.existsSync(destPath)) {
            const resp = await fetch(`${baseUrl}/api/assets/${encodeURIComponent(assetId)}`)
            if (!resp.ok) return item
            const arrBuf = await resp.arrayBuffer()
            fs.writeFileSync(destPath, Buffer.from(arrBuf))
          }

          const normalized = destPath.replace(/\\/g, '/')
          const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
          const encoded = withLeadingSlash
            .split('/')
            .map((seg, idx) =>
              idx === 1 && /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)
            )
            .join('/')
          const nextItem: Record<string, unknown> = {
            ...item,
            src: `local-media://file${encoded}`
          }
          if (typeof item.filePath === 'string' || item.type === 'model3d') {
            nextItem.filePath = destPath
          }
          return nextItem
        })
      )
      return updatedItems
    }
  )
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pinsync.app')
  app.setName('PinSync')

  // Harden permission requests from embedded <webview> pages
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
    const allowed = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen'])
    callback(allowed.has(permission))
  })

  registerLocalMediaProtocol()
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  try {
    const dragDir = join(app.getPath('temp'), 'pinsync-drag')
    if (fs.existsSync(dragDir)) {
      fs.rmSync(dragDir, { recursive: true, force: true })
    }
  } catch {
    // ignore cleanup errors
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
