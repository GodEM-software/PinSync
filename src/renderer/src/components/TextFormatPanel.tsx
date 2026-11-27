import React from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  X
} from 'lucide-react'
import type {
  ArrowHeadStyle,
  ArrowItem,
  ArrowRouting,
  BoardItem,
  FlowchartItem,
  FlowchartShape,
  TextItem
} from '../types/board'

interface TextFormatPanelProps {
  item: TextItem | FlowchartItem | ArrowItem
  onUpdate: (id: string, patch: Partial<BoardItem>) => void
  onClose: () => void
}

const SWATCHES = ['#f8fafc', '#93c5fd', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc']

const FONTS = [
  { label: 'Sans', value: 'Inter, Segoe UI, sans-serif' },
  { label: 'Mono', value: 'Consolas, ui-monospace, monospace' },
  { label: 'Serif', value: 'Georgia, Times New Roman, serif' },
  { label: 'Display', value: 'Trebuchet MS, Segoe UI, sans-serif' }
]

const SHAPES: { value: FlowchartShape; label: string }[] = [
  { value: 'rect', label: 'Rect' },
  { value: 'rounded', label: 'Round' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'pill', label: 'Pill' },
  { value: 'parallelogram', label: 'I/O' },
  { value: 'cylinder', label: 'DB' }
]

export const TextFormatPanel: React.FC<TextFormatPanelProps> = ({ item, onUpdate, onClose }) => {
  return (
    <aside
      className="format-panel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="format-panel-header">
        <span>
          {item.type === 'text'
            ? 'Text Settings'
            : item.type === 'flowchart'
              ? 'Flowchart Shape'
              : 'Arrow Settings'}
        </span>
        <button className="win-btn" onClick={onClose} title="Close panel">
          <X size={13} />
        </button>
      </div>

      {item.type === 'text' && (
        <div className="format-panel-body">
          <div className="fp-row">
            <label>Font</label>
            <select
              className="fp-select"
              value={item.fontFamily}
              onChange={(e) => onUpdate(item.id, { fontFamily: e.target.value })}
            >
              {FONTS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="fp-row">
            <label>Size</label>
            <input
              type="range"
              min={11}
              max={72}
              step={1}
              value={item.fontSize}
              onChange={(e) => onUpdate(item.id, { fontSize: parseInt(e.target.value, 10) })}
            />
            <span className="fp-val">{item.fontSize}px</span>
          </div>

          <div className="fp-btn-group">
            <button
              className={`fp-btn ${item.fontWeight === 'bold' ? 'active' : ''}`}
              title="Bold"
              onClick={() =>
                onUpdate(item.id, {
                  fontWeight: item.fontWeight === 'bold' ? 'normal' : 'bold'
                })
              }
            >
              <Bold size={13} />
            </button>
            <button
              className={`fp-btn ${item.fontStyle === 'italic' ? 'active' : ''}`}
              title="Italic"
              onClick={() =>
                onUpdate(item.id, {
                  fontStyle: item.fontStyle === 'italic' ? 'normal' : 'italic'
                })
              }
            >
              <Italic size={13} />
            </button>
            <button
              className={`fp-btn ${item.textDecoration === 'underline' ? 'active' : ''}`}
              title="Underline"
              onClick={() =>
                onUpdate(item.id, {
                  textDecoration: item.textDecoration === 'underline' ? 'none' : 'underline'
                })
              }
            >
              <Underline size={13} />
            </button>
            <button
              className={`fp-btn ${item.textDecoration === 'line-through' ? 'active' : ''}`}
              title="Strikethrough"
              onClick={() =>
                onUpdate(item.id, {
                  textDecoration: item.textDecoration === 'line-through' ? 'none' : 'line-through'
                })
              }
            >
              <Strikethrough size={13} />
            </button>

            <div className="fp-divider-v" />

            <button
              className={`fp-btn ${item.textAlign === 'left' ? 'active' : ''}`}
              title="Align Left"
              onClick={() => onUpdate(item.id, { textAlign: 'left' })}
            >
              <AlignLeft size={13} />
            </button>
            <button
              className={`fp-btn ${item.textAlign === 'center' ? 'active' : ''}`}
              title="Align Center"
              onClick={() => onUpdate(item.id, { textAlign: 'center' })}
            >
              <AlignCenter size={13} />
            </button>
            <button
              className={`fp-btn ${item.textAlign === 'right' ? 'active' : ''}`}
              title="Align Right"
              onClick={() => onUpdate(item.id, { textAlign: 'right' })}
            >
              <AlignRight size={13} />
            </button>
          </div>

          <div className="fp-row">
            <label>Text Color</label>
            <div className="fp-swatches">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`fp-swatch ${item.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => onUpdate(item.id, { color: c })}
                />
              ))}
              <input
                type="color"
                className="fp-color-input"
                value={item.color}
                onChange={(e) => onUpdate(item.id, { color: e.target.value })}
              />
            </div>
          </div>

          <div className="fp-row">
            <label>Card Fill</label>
            <div className="fp-btn-group compact">
              <button
                className={`fp-pill ${item.backgroundColor === 'transparent' ? 'active' : ''}`}
                onClick={() =>
                  onUpdate(item.id, {
                    backgroundColor: 'transparent',
                    borderColor: 'transparent'
                  })
                }
              >
                None
              </button>
              <button
                className={`fp-pill ${item.backgroundColor !== 'transparent' ? 'active' : ''}`}
                onClick={() =>
                  onUpdate(item.id, {
                    backgroundColor: 'rgba(28, 31, 39, 0.78)',
                    borderColor: 'rgba(148, 163, 184, 0.25)'
                  })
                }
              >
                Card
              </button>
              <button
                className="fp-pill"
                onClick={() =>
                  onUpdate(item.id, {
                    backgroundColor: 'rgba(250, 204, 21, 0.16)',
                    borderColor: 'rgba(250, 204, 21, 0.45)'
                  })
                }
              >
                Note
              </button>
            </div>
          </div>
        </div>
      )}

      {item.type === 'flowchart' && (
        <div className="format-panel-body">
          <div className="fp-row">
            <label>Shape</label>
          </div>
          <div className="fp-shape-grid">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                className={`fp-pill ${item.shape === s.value ? 'active' : ''}`}
                onClick={() => onUpdate(item.id, { shape: s.value })}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="fp-row">
            <label>Font Size</label>
            <input
              type="range"
              min={11}
              max={32}
              value={item.fontSize}
              onChange={(e) => onUpdate(item.id, { fontSize: parseInt(e.target.value, 10) })}
            />
            <span className="fp-val">{item.fontSize}px</span>
          </div>

          <div className="fp-row">
            <label>Border</label>
            <div className="fp-swatches">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`fp-swatch ${item.borderColor === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => onUpdate(item.id, { borderColor: c })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {item.type === 'arrow' && (
        <div className="format-panel-body">
          <div className="fp-row">
            <label>Routing</label>
            <div className="fp-btn-group compact">
              {(['straight', 'curved', 'elbow'] as ArrowRouting[]).map((r) => (
                <button
                  key={r}
                  className={`fp-pill ${item.routing === r ? 'active' : ''}`}
                  onClick={() => onUpdate(item.id, { routing: r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="fp-row">
            <label>Thickness</label>
            <input
              type="range"
              min={1.5}
              max={8}
              step={0.5}
              value={item.strokeWidth}
              onChange={(e) => onUpdate(item.id, { strokeWidth: parseFloat(e.target.value) })}
            />
            <span className="fp-val">{item.strokeWidth}px</span>
          </div>

          <div className="fp-row">
            <label>Style</label>
            <div className="fp-btn-group compact">
              <button
                className={`fp-pill ${!item.dashed ? 'active' : ''}`}
                onClick={() => onUpdate(item.id, { dashed: false })}
              >
                Solid
              </button>
              <button
                className={`fp-pill ${item.dashed ? 'active' : ''}`}
                onClick={() => onUpdate(item.id, { dashed: true })}
              >
                Dashed
              </button>
            </div>
          </div>

          <div className="fp-row">
            <label>Heads</label>
            <select
              className="fp-select small"
              value={item.startHead}
              onChange={(e) => onUpdate(item.id, { startHead: e.target.value as ArrowHeadStyle })}
            >
              <option value="none">Start: None</option>
              <option value="arrow">Start: Arrow</option>
              <option value="dot">Start: Dot</option>
            </select>
            <select
              className="fp-select small"
              value={item.endHead}
              onChange={(e) => onUpdate(item.id, { endHead: e.target.value as ArrowHeadStyle })}
            >
              <option value="arrow">End: Arrow</option>
              <option value="dot">End: Dot</option>
              <option value="none">End: None</option>
            </select>
          </div>

          <div className="fp-row">
            <label>Label</label>
            <input
              type="text"
              className="fp-input"
              value={item.label || ''}
              placeholder="Optional label..."
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => onUpdate(item.id, { label: e.target.value })}
            />
          </div>

          <div className="fp-row">
            <label>Color</label>
            <div className="fp-swatches">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`fp-swatch ${item.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => onUpdate(item.id, { color: c })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
