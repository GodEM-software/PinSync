import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, MousePointerClick, RotateCw } from 'lucide-react'
import type { ItemRendererProps, WebpageItem } from '../types/board'
import { normalizeWebUrl } from '../utils/fileClassifier'

interface WebviewElement extends HTMLElement {
  src: string
  goBack: () => void
  goForward: () => void
  reload: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  getURL: () => string
  getTitle: () => string
}

export const WebpageItemView: React.FC<ItemRendererProps<WebpageItem>> = ({
  item,
  isInteractive,
  onUpdate,
  onRequestInteract
}) => {
  const webviewRef = useRef<WebviewElement | null>(null)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const address = editingAddress ?? item.url

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStart = (): void => setLoading(true)
    const onStop = (): void => {
      setLoading(false)
      try {
        const currentUrl = wv.getURL()
        const title = wv.getTitle()
        if (currentUrl && currentUrl !== item.url) {
          setEditingAddress(null)
          onUpdate({ url: currentUrl, name: title || currentUrl })
        } else if (title && title !== item.name) {
          onUpdate({ name: title })
        }
      } catch {
        // ignore webview readiness errors
      }
    }

    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    return () => {
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
    }
  }, [item.name, item.url, onUpdate])

  const handleNavigate = (e: React.FormEvent): void => {
    e.preventDefault()
    const normalized = normalizeWebUrl(address)
    if (!normalized) return
    setEditingAddress(null)
    onUpdate({ url: normalized })
    if (webviewRef.current) {
      webviewRef.current.src = normalized
    }
  }

  return (
    <div className="item-webpage-container">
      <div
        className="webpage-toolbar"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="media-btn"
          title="Back"
          onClick={() => {
            if (webviewRef.current?.canGoBack()) webviewRef.current.goBack()
          }}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          className="media-btn"
          title="Forward"
          onClick={() => {
            if (webviewRef.current?.canGoForward()) webviewRef.current.goForward()
          }}
        >
          <ArrowRight size={13} />
        </button>
        <button
          className={`media-btn ${loading ? 'spinning' : ''}`}
          title="Reload"
          onClick={() => webviewRef.current?.reload()}
        >
          <RotateCw size={13} />
        </button>

        <form onSubmit={handleNavigate} className="webpage-url-form">
          <input
            type="text"
            className="webpage-url-input"
            value={address}
            onChange={(e) => setEditingAddress(e.target.value)}
            onBlur={() => setEditingAddress(null)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="https://..."
          />
        </form>

        <button
          className={`media-btn ${isInteractive ? 'active' : ''}`}
          title={isInteractive ? 'Interactive (Esc to exit)' : 'Double-click or click to browse'}
          onClick={onRequestInteract}
        >
          <MousePointerClick size={13} />
        </button>

        <button
          className="media-btn"
          title="Open in External Browser"
          onClick={() => void window.api.openExternal(item.url)}
        >
          <ExternalLink size={13} />
        </button>
      </div>

      <div className="webpage-viewport">
        {React.createElement('webview', {
          ref: webviewRef,
          src: item.url,
          allowpopups: 'true',
          style: {
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#ffffff'
          }
        })}

        {!isInteractive && (
          <div
            className="interact-shield"
            title="Drag to move · Double-click to interact with webpage"
          >
            <span className="interact-hint">Double-click to interact</span>
          </div>
        )}
      </div>
    </div>
  )
}
