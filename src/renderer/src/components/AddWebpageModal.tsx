import React, { useEffect, useRef, useState } from 'react'
import { Globe, X } from 'lucide-react'
import { normalizeWebUrl } from '../utils/fileClassifier'

interface AddWebpageModalProps {
  onConfirm: (url: string) => void
  onClose: () => void
}

export const AddWebpageModal: React.FC<AddWebpageModalProps> = ({ onConfirm, onClose }) => {
  const [url, setUrl] = useState('https://')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    const normalized = normalizeWebUrl(url)
    if (!normalized) return
    onConfirm(normalized)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Globe size={15} />
            <span>Add Webpage Reference</span>
          </div>
          <button className="win-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label className="modal-label">Enter website URL</label>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/Color_theory"
          />
          <p className="modal-hint">
            Tip: You can also paste any URL directly onto the canvas with <code>Ctrl+V</code>, or
            drag a link from your browser.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add to Board
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
