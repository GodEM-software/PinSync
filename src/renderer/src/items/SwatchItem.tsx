import React, { useState } from 'react'
import { Check, Copy, Pipette } from 'lucide-react'
import type { ItemRendererProps, SwatchItem } from '../types/board'

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return ''
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return ''
  return `rgb(${r}, ${g}, ${b})`
}

function isLightHex(hex: string): boolean {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return false
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155
}

export const SwatchItemView: React.FC<ItemRendererProps<SwatchItem>> = ({ item, onUpdate }) => {
  const [copied, setCopied] = useState(false)
  const light = isLightHex(item.hex)
  const rgb = hexToRgb(item.hex)

  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void navigator.clipboard?.writeText(item.hex)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1100)
  }

  return (
    <div className="item-swatch-container">
      <div className="swatch-color-block" style={{ backgroundColor: item.hex }}>
        <button
          className="swatch-copy-btn"
          style={{ color: light ? '#0f172a' : '#f8fafc' }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleCopy}
          title="Copy Hex"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : item.hex}</span>
        </button>

        <label
          className="swatch-picker-btn"
          style={{ color: light ? '#0f172a' : '#f8fafc' }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Change color"
        >
          <Pipette size={12} />
          <input
            type="color"
            value={item.hex}
            onChange={(e) =>
              onUpdate({ hex: e.target.value.toUpperCase(), name: e.target.value.toUpperCase() })
            }
          />
        </label>
      </div>

      <div className="swatch-footer">
        <span className="swatch-rgb">{rgb || item.hex}</span>
        {item.label && <span className="swatch-label">{item.label}</span>}
      </div>
    </div>
  )
}
