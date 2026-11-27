import React, { useEffect, useRef } from 'react'
import type { ItemRendererProps, TextItem } from '../types/board'

export const TextItemView: React.FC<ItemRendererProps<TextItem>> = ({
  item,
  isInteractive,
  onUpdate,
  onFinishInteract,
  onTriggerArrowFromText
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (isInteractive && textareaRef.current) {
      const el = textareaRef.current
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [isInteractive])

  const sharedStyle: React.CSSProperties = {
    fontSize: `${item.fontSize}px`,
    fontFamily: item.fontFamily,
    fontWeight: item.fontWeight,
    fontStyle: item.fontStyle,
    textDecoration: item.textDecoration,
    textAlign: item.textAlign,
    color: item.color,
    lineHeight: 1.38
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value
    const el = e.target
    const neededH = Math.max(48, el.scrollHeight + 16)
    const lines = val.split('\n')
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
    const approxW = Math.max(160, Math.min(720, longest * (item.fontSize * 0.62) + 32))
    onUpdate({
      text: val,
      height: Math.max(item.height, neededH),
      width: Math.max(item.width, approxW)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === ' ' && item.text.trim().toLowerCase() === 'aaa' && onTriggerArrowFromText) {
      e.preventDefault()
      e.stopPropagation()
      onTriggerArrowFromText()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onFinishInteract?.()
      return
    }
    // Keep normal typing from triggering global canvas shortcuts
    e.stopPropagation()
  }

  return (
    <div
      className="item-text-container"
      style={{
        backgroundColor: item.backgroundColor,
        borderColor: item.borderColor,
        borderRadius: `${item.borderRadius}px`
      }}
    >
      {isInteractive ? (
        <textarea
          ref={textareaRef}
          className="text-item-editor"
          style={sharedStyle}
          value={item.text}
          placeholder="Type text..."
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="text-item-display" style={sharedStyle}>
          {item.text || <span className="text-placeholder">Double-click to type…</span>}
        </div>
      )}
    </div>
  )
}
