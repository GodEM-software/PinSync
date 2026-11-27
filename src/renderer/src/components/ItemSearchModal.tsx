import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { BoardItem } from '../types/board'

interface ItemSearchModalProps {
  items: BoardItem[]
  onJumpToItem: (item: BoardItem) => void
  onClose: () => void
}

function getItemSummary(item: BoardItem): string {
  switch (item.type) {
    case 'text':
      return item.text || 'Empty text'
    case 'webpage':
      return item.url
    case 'flowchart':
      return `${item.shape} · ${item.label}`
    case 'swatch':
      return item.hex
    case 'code':
      return `${item.language} · ${item.name}`
    default:
      return item.name
  }
}

export const ItemSearchModal: React.FC<ItemSearchModalProps> = ({
  items,
  onJumpToItem,
  onClose
}) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.type.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        getItemSummary(it).toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card modal-search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Search size={14} />
            <span>Jump to Board Item ({items.length})</span>
          </div>
          <button className="win-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="search-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            value={query}
            placeholder="Filter by name, type, URL, text, or hex…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && filtered.length > 0) {
                onJumpToItem(filtered[0])
                onClose()
              }
            }}
          />
        </div>

        <div className="search-results">
          {filtered.length === 0 ? (
            <div className="search-empty">No matching items on the board.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                className="search-row"
                onClick={() => {
                  onJumpToItem(item)
                  onClose()
                }}
              >
                <span className={`type-pill type-${item.type}`}>{item.type}</span>
                <span className="search-row-text">{getItemSummary(item)}</span>
                <span className="search-row-coords">
                  {Math.round(item.x)}, {Math.round(item.y)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
