import React, { useEffect, useState } from 'react'
import { Keyboard, RotateCcw, X } from 'lucide-react'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  eventToShortcutString,
  type ShortcutAction,
  type ShortcutConfig
} from '../utils/shortcuts'

interface ShortcutsModalProps {
  config: ShortcutConfig
  onChange: (next: ShortcutConfig) => void
  onClose: () => void
}

const CATEGORIES = [
  'Canvas & Creation',
  'Selection & Editing',
  'Transforms & Layers',
  'Board & Window'
]

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ config, onChange, onClose }) => {
  const [capturingAction, setCapturingAction] = useState<ShortcutAction | null>(null)

  useEffect(() => {
    if (!capturingAction) return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setCapturingAction(null)
        return
      }

      const binding = eventToShortcutString(e)
      if (!binding) return

      onChange({
        ...config,
        bindings: {
          ...config.bindings,
          [capturingAction]: binding
        }
      })
      setCapturingAction(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [capturingAction, config, onChange])

  const allActions = Object.keys(SHORTCUT_LABELS) as ShortcutAction[]

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Keyboard size={15} />
            <span>Keyboard Shortcuts & Canvas Settings</span>
          </div>
          <div className="modal-header-actions">
            <button
              className="btn-secondary small"
              onClick={() => onChange(DEFAULT_SHORTCUTS)}
              title="Reset all shortcuts to defaults"
            >
              <RotateCcw size={12} /> Reset All
            </button>
            <button className="win-btn" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body shortcuts-list">
          <div className="shortcut-group">
            <h4>Mouse & Direct Canvas Behavior</h4>
            <div className="shortcut-row">
              <span>Type directly on canvas</span>
              <code>Start typing anywhere on empty canvas</code>
            </div>
            <div className="shortcut-row">
              <span>
                Quick Arrow Trigger (<code>aaa</code> + <code>Space</code>)
              </span>
              <label className="toggle-pill">
                <input
                  type="checkbox"
                  checked={config.aaaArrowEnabled}
                  onChange={(e) => onChange({ ...config, aaaArrowEnabled: e.target.checked })}
                />
                <span>{config.aaaArrowEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            <div className="shortcut-row">
              <span>Pan Canvas</span>
              <code>Middle Drag · Alt+Drag · Space+Drag</code>
            </div>
            <div className="shortcut-row">
              <span>Zoom Canvas</span>
              <code>Mouse Wheel · Z+Drag</code>
            </div>
            <div className="shortcut-row">
              <span>Move Window / Context Menu</span>
              <code>Right Drag / Right Click</code>
            </div>
          </div>

          {CATEGORIES.map((cat) => {
            const actions = allActions.filter((a) => SHORTCUT_LABELS[a].category === cat)
            return (
              <div key={cat} className="shortcut-group">
                <h4>{cat}</h4>
                {actions.map((action) => {
                  const binding = config.bindings[action]
                  const isCapturing = capturingAction === action
                  return (
                    <div key={action} className="shortcut-row">
                      <span>{SHORTCUT_LABELS[action].label}</span>
                      <div className="shortcut-edit-controls">
                        <button
                          type="button"
                          className={`shortcut-key-btn ${isCapturing ? 'capturing' : ''}`}
                          onClick={() => setCapturingAction(isCapturing ? null : action)}
                          title="Click and press new shortcut"
                        >
                          {isCapturing ? 'Press keys… (Esc cancel)' : binding || 'Unbound'}
                        </button>
                        {binding && (
                          <button
                            type="button"
                            className="win-btn tiny"
                            title="Clear shortcut"
                            onClick={() =>
                              onChange({
                                ...config,
                                bindings: { ...config.bindings, [action]: '' }
                              })
                            }
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
