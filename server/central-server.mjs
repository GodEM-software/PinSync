/* eslint-disable @typescript-eslint/explicit-function-return-type */
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'text/plain; charset=utf-8',
  '.stl': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.step': 'application/step',
  '.stp': 'application/step',
  '.zip': 'application/zip',
  '.json': 'application/json'
}

export function createCentralServer(dataDir) {
  const boardsDir = path.join(dataDir, 'boards')
  const assetsDir = path.join(dataDir, 'assets')
  fs.mkdirSync(boardsDir, { recursive: true })
  fs.mkdirSync(assetsDir, { recursive: true })

  // boardId -> Set<http.ServerResponse>
  const sseClients = new Map()

  function broadcastBoardUpdate(boardId, payload) {
    const clients = sseClients.get(boardId)
    if (!clients || clients.size === 0) return
    const msg = `event: board-updated\ndata: ${JSON.stringify(payload)}\n\n`
    for (const res of clients) {
      try {
        res.write(msg)
      } catch {
        clients.delete(res)
      }
    }
  }

  function sendJson(res, status, data) {
    const body = JSON.stringify(data)
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end(body)
  }

  function readBody(req, maxBytes = 160 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let total = 0
      req.on('data', (chunk) => {
        total += chunk.length
        if (total > maxBytes) {
          reject(new Error('Payload too large'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      })
      res.end()
      return
    }

    const url = new URL(req.url || '/', 'http://localhost')
    const pathname = url.pathname

    try {
      if (req.method === 'GET' && pathname === '/health') {
        sendJson(res, 200, { ok: true, name: 'PinSync Central Server' })
        return
      }

      // Upload asset (deduplicated by SHA-1)
      if (req.method === 'POST' && pathname === '/api/assets') {
        const raw = await readBody(req)
        const parsed = JSON.parse(raw.toString('utf-8'))
        const fileName = String(parsed.fileName || 'asset.bin').replace(/[<>:"/\\|?*]/g, '_')
        const mimeType = String(parsed.mimeType || 'application/octet-stream')
        const buf = Buffer.from(String(parsed.dataBase64 || ''), 'base64')
        const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)
        const ext = path.extname(fileName).toLowerCase()
        const assetId = `${hash}${ext}`
        const filePath = path.join(assetsDir, assetId)
        const metaPath = path.join(assetsDir, `${assetId}.meta.json`)

        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, buf)
        }
        fs.writeFileSync(
          metaPath,
          JSON.stringify({ assetId, fileName, mimeType, size: buf.length })
        )

        sendJson(res, 200, { assetId, fileName, mimeType, size: buf.length })
        return
      }

      // Download asset
      if (req.method === 'GET' && pathname.startsWith('/api/assets/')) {
        const assetId = decodeURIComponent(pathname.slice('/api/assets/'.length)).replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        )
        const filePath = path.join(assetsDir, assetId)
        if (!fs.existsSync(filePath)) {
          sendJson(res, 404, { error: 'Asset not found' })
          return
        }
        const metaPath = path.join(assetsDir, `${assetId}.meta.json`)
        let mimeType = MIME_TYPES[path.extname(assetId).toLowerCase()] || 'application/octet-stream'
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
            if (meta.mimeType) mimeType = meta.mimeType
          } catch {
            // ignore meta parse errors
          }
        }
        const stat = fs.statSync(filePath)
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': String(stat.size),
          'Access-Control-Allow-Origin': '*'
        })
        fs.createReadStream(filePath).pipe(res)
        return
      }

      // List all boards on server
      if (req.method === 'GET' && pathname === '/api/boards') {
        const files = fs.readdirSync(boardsDir).filter((f) => f.endsWith('.json'))
        const list = files
          .map((f) => {
            try {
              const b = JSON.parse(fs.readFileSync(path.join(boardsDir, f), 'utf-8'))
              return {
                boardId: b.boardId,
                name: b.name,
                itemCount: Array.isArray(b.items) ? b.items.length : 0,
                version: b.version || 1,
                updatedAt: b.updatedAt
              }
            } catch {
              return null
            }
          })
          .filter(Boolean)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        sendJson(res, 200, { boards: list })
        return
      }

      // Create / publish board
      if (req.method === 'POST' && pathname === '/api/boards') {
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf-8'))
        const boardId =
          typeof body.boardId === 'string' && body.boardId.trim()
            ? body.boardId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
            : `board_${crypto.randomBytes(3).toString('hex')}`
        const doc = {
          boardId,
          name: body.name || 'Shared Board',
          theme: body.theme || 'charcoal',
          viewport: body.viewport || { panX: 660, panY: 410, zoom: 1 },
          items: Array.isArray(body.items) ? body.items : [],
          version: 1,
          updatedAt: Date.now(),
          updatedBy: body.clientId || 'host'
        }
        fs.writeFileSync(path.join(boardsDir, `${boardId}.json`), JSON.stringify(doc, null, 2))
        sendJson(res, 200, doc)
        return
      }

      // SSE live updates for a board
      if (
        req.method === 'GET' &&
        pathname.endsWith('/events') &&
        pathname.startsWith('/api/boards/')
      ) {
        const boardId = pathname
          .slice('/api/boards/'.length, -'/events'.length)
          .replace(/[^a-zA-Z0-9_-]/g, '')
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        })
        res.write(`event: connected\ndata: ${JSON.stringify({ boardId })}\n\n`)
        if (!sseClients.has(boardId)) sseClients.set(boardId, new Set())
        sseClients.get(boardId).add(res)
        req.on('close', () => {
          sseClients.get(boardId)?.delete(res)
        })
        return
      }

      // Get board
      if (req.method === 'GET' && pathname.startsWith('/api/boards/')) {
        const boardId = pathname.slice('/api/boards/'.length).replace(/[^a-zA-Z0-9_-]/g, '')
        const filePath = path.join(boardsDir, `${boardId}.json`)
        if (!fs.existsSync(filePath)) {
          sendJson(res, 404, { error: 'Board not found' })
          return
        }
        const doc = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        sendJson(res, 200, doc)
        return
      }

      // Update / refine board
      if (req.method === 'PUT' && pathname.startsWith('/api/boards/')) {
        const boardId = pathname.slice('/api/boards/'.length).replace(/[^a-zA-Z0-9_-]/g, '')
        const filePath = path.join(boardsDir, `${boardId}.json`)
        const raw = await readBody(req)
        const body = JSON.parse(raw.toString('utf-8'))
        let prevVersion = 0
        if (fs.existsSync(filePath)) {
          try {
            const prev = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            prevVersion = prev.version || 0
          } catch {
            // ignore
          }
        }
        const doc = {
          boardId,
          name: body.name || 'Shared Board',
          theme: body.theme || 'charcoal',
          viewport: body.viewport || { panX: 660, panY: 410, zoom: 1 },
          items: Array.isArray(body.items) ? body.items : [],
          version: prevVersion + 1,
          updatedAt: Date.now(),
          updatedBy: body.clientId || 'peer'
        }
        fs.writeFileSync(filePath, JSON.stringify(doc, null, 2))
        broadcastBoardUpdate(boardId, doc)
        sendJson(res, 200, doc)
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'Server error' })
    }
  })

  return server
}

// Allow running standalone via `node server/central-server.mjs`
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('central-server.mjs')

if (isDirectRun) {
  const port = Number(process.env.PORT || 4580)
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'server-data')
  const srv = createCentralServer(dataDir)
  srv.listen(port, '0.0.0.0', () => {
    console.log(`VisualDock Central Server running on http://0.0.0.0:${port}`)
  })
}
