import React, { useCallback, useEffect, useState } from 'react'
import { Cloud, Copy, Play, RefreshCw, Server, Square, Upload, Users, X } from 'lucide-react'

export interface ServerBoardSummary {
  boardId: string
  name: string
  itemCount: number
  version: number
  updatedAt: number
}

export interface OnlineSessionInfo {
  serverUrl: string
  boardId: string
  version: number
  connected: boolean
}

interface OnlineModalProps {
  session: OnlineSessionInfo | null
  initialServerUrl: string
  onClose: () => void
  onPublishBoard: (serverUrl: string, existingBoardId?: string) => Promise<void>
  onJoinBoard: (serverUrl: string, boardId: string) => Promise<void>
  onDisconnect: () => void
}

export const OnlineModal: React.FC<OnlineModalProps> = ({
  session,
  initialServerUrl,
  onClose,
  onPublishBoard,
  onJoinBoard,
  onDisconnect
}) => {
  const [serverUrl, setServerUrl] = useState(session?.serverUrl || initialServerUrl)
  const [joinBoardId, setJoinBoardId] = useState(session?.boardId || '')
  const [hostStatus, setHostStatus] = useState<{
    running: boolean
    port: number
    urls: string[]
  }>({ running: false, port: 4580, urls: [] })
  const [boards, setBoards] = useState<ServerBoardSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const fetchBoards = useCallback(async (url: string) => {
    const clean = url.trim().replace(/\/+$/, '')
    if (!clean) return
    try {
      setError(null)
      const res = await fetch(`${clean}/api/boards`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { boards: ServerBoardSummary[] }
      setBoards(Array.isArray(data.boards) ? data.boards : [])
    } catch {
      setBoards([])
      setError('Cannot reach central server at that URL')
    }
  }, [])

  useEffect(() => {
    let active = true
    void window.api.getCentralServerStatus().then((st) => {
      if (active) setHostStatus(st)
    })
    const clean = serverUrl.trim().replace(/\/+$/, '')
    if (clean) {
      void fetch(`${clean}/api/boards`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data: { boards: ServerBoardSummary[] }) => {
          if (active) {
            setError(null)
            setBoards(Array.isArray(data.boards) ? data.boards : [])
          }
        })
        .catch(() => {
          if (active) {
            setBoards([])
            setError('Cannot reach central server at that URL')
          }
        })
    }
    return () => {
      active = false
    }
  }, [serverUrl])

  const handleToggleHost = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = hostStatus.running
        ? await window.api.stopCentralServer()
        : await window.api.startCentralServer(4580)
      setHostStatus(next)
      if (next.running) {
        const local = 'http://127.0.0.1:4580'
        setServerUrl(local)
        await fetchBoards(local)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle central server')
    } finally {
      setBusy(false)
    }
  }

  const copyVal = (text: string): void => {
    void navigator.clipboard?.writeText(text)
    setCopiedText(text)
    window.setTimeout(() => setCopiedText(null), 1600)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Cloud size={16} />
            <span>Online Mode &amp; Central Server</span>
          </div>
          <button className="win-btn tiny" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Active Session Banner */}
          {session && (
            <div className="online-session-banner">
              <div>
                <div style={{ fontWeight: 600, color: '#6ee7b7', fontSize: 12 }}>
                  Live Sync Active · Room: <code>{session.boardId}</code> (v{session.version})
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Server: {session.serverUrl} · Edits &amp; assets sync automatically
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-secondary small"
                  onClick={() => copyVal(session.boardId)}
                  title="Copy Board ID"
                >
                  <Copy size={12} /> {copiedText === session.boardId ? 'Copied!' : 'Copy ID'}
                </button>
                <button className="btn-secondary small" onClick={onDisconnect}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Built-in Central Server Host */}
          <div className="online-box">
            <div className="online-box-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Server size={14} color="#60a5fa" />
                <strong>Host Central Server (on this PC)</strong>
              </span>
              <button
                className={hostStatus.running ? 'btn-secondary small' : 'btn-primary small'}
                style={{ height: 26, padding: '0 10px', fontSize: 11 }}
                disabled={busy}
                onClick={() => void handleToggleHost()}
              >
                {hostStatus.running ? (
                  <>
                    <Square size={11} /> Stop Server
                  </>
                ) : (
                  <>
                    <Play size={11} /> Start Server (:4580)
                  </>
                )}
              </button>
            </div>
            {hostStatus.running ? (
              <div className="online-urls">
                {hostStatus.urls.map((u) => (
                  <button
                    key={u}
                    className="ctx-chip"
                    onClick={() => copyVal(u)}
                    title="Click to copy server URL for another person"
                  >
                    <span>{u}</span>
                    <Copy size={11} />
                  </button>
                ))}
                {copiedText && hostStatus.urls.includes(copiedText) && (
                  <span style={{ fontSize: 11, color: '#6ee7b7' }}>Copied!</span>
                )}
              </div>
            ) : (
              <div className="modal-hint" style={{ marginTop: 4 }}>
                Start the built-in server to store boards &amp; assets centrally, or connect to a
                remote server URL below.
              </div>
            )}
          </div>

          {/* Central Server URL + Publish / Join */}
          <div>
            <label className="modal-label">Central Server URL</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="modal-input"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://127.0.0.1:4580"
              />
              <button
                className="btn-secondary"
                onClick={() => void fetchBoards(serverUrl)}
                title="Refresh server boards"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="online-box">
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Upload Current Board &amp; Assets
              </div>
              <button
                className="btn-primary"
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setError(null)
                  void onPublishBoard(serverUrl, session?.boardId)
                    .then(() => fetchBoards(serverUrl))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Publish failed'))
                    .finally(() => setBusy(false))
                }}
              >
                <Upload size={13} />
                {session ? 'Push Update to Server' : 'Publish Board to Server'}
              </button>
            </div>

            <div className="online-box">
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                Join Another Person&apos;s Board
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="modal-input"
                  style={{ height: 30 }}
                  value={joinBoardId}
                  onChange={(e) => setJoinBoardId(e.target.value)}
                  placeholder="Board ID (e.g. board_a1b2c3)"
                />
                <button
                  className="btn-primary"
                  disabled={busy || !joinBoardId.trim()}
                  onClick={() => {
                    setBusy(true)
                    setError(null)
                    void onJoinBoard(serverUrl, joinBoardId.trim())
                      .then(() => onClose())
                      .catch((err) => setError(err instanceof Error ? err.message : 'Join failed'))
                      .finally(() => setBusy(false))
                  }}
                >
                  <Users size={13} />
                </button>
              </div>
            </div>
          </div>

          {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}

          {/* Boards on Central Server */}
          <div>
            <div className="modal-label">Boards on Central Server ({boards.length})</div>
            <div className="online-board-list">
              {boards.length === 0 ? (
                <div style={{ fontSize: 11.5, color: '#7c8497', padding: 8 }}>
                  No boards found on this server yet.
                </div>
              ) : (
                boards.map((b) => (
                  <div key={b.boardId} className="online-board-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#8b93a7' }}>
                        ID: <code>{b.boardId}</code> · {b.itemCount} items · v{b.version}
                      </div>
                    </div>
                    <button
                      className="btn-secondary small"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        void onJoinBoard(serverUrl, b.boardId)
                          .then(() => onClose())
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Join failed')
                          )
                          .finally(() => setBusy(false))
                      }}
                    >
                      Open &amp; Sync
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
