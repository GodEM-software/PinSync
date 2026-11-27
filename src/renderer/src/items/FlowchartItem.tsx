import React, { useEffect, useRef } from 'react'
import type { FlowchartItem, ItemRendererProps } from '../types/board'

export const FlowchartItemView: React.FC<ItemRendererProps<FlowchartItem>> = ({
  item,
  isInteractive,
  onUpdate,
  onFinishInteract
}) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (isInteractive && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isInteractive])

  const w = Math.max(40, item.width)
  const h = Math.max(32, item.height)
  const sw = 2

  const renderShape = (): React.ReactNode => {
    switch (item.shape) {
      case 'rect':
        return (
          <rect
            x={sw}
            y={sw}
            width={w - sw * 2}
            height={h - sw * 2}
            rx={3}
            fill={item.fillColor}
            stroke={item.borderColor}
            strokeWidth={sw}
          />
        )
      case 'rounded':
        return (
          <rect
            x={sw}
            y={sw}
            width={w - sw * 2}
            height={h - sw * 2}
            rx={14}
            fill={item.fillColor}
            stroke={item.borderColor}
            strokeWidth={sw}
          />
        )
      case 'pill':
        return (
          <rect
            x={sw}
            y={sw}
            width={w - sw * 2}
            height={h - sw * 2}
            rx={Math.min(w, h) / 2}
            fill={item.fillColor}
            stroke={item.borderColor}
            strokeWidth={sw}
          />
        )
      case 'diamond': {
        const pts = `${w / 2},${sw} ${w - sw},${h / 2} ${w / 2},${h - sw} ${sw},${h / 2}`
        return (
          <polygon
            points={pts}
            fill={item.fillColor}
            stroke={item.borderColor}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        )
      }
      case 'parallelogram': {
        const skew = Math.min(26, w * 0.18)
        const pts = `${skew},${sw} ${w - sw},${sw} ${w - skew},${h - sw} ${sw},${h - sw}`
        return (
          <polygon
            points={pts}
            fill={item.fillColor}
            stroke={item.borderColor}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        )
      }
      case 'cylinder': {
        const ry = Math.min(14, h * 0.16)
        const rx = (w - sw * 2) / 2
        const cx = w / 2
        return (
          <g>
            <path
              d={`M ${sw} ${ry + sw} L ${sw} ${h - ry - sw} A ${rx} ${ry} 0 0 0 ${w - sw} ${h - ry - sw} L ${w - sw} ${ry + sw} Z`}
              fill={item.fillColor}
              stroke={item.borderColor}
              strokeWidth={sw}
            />
            <ellipse
              cx={cx}
              cy={ry + sw}
              rx={rx}
              ry={ry}
              fill={item.fillColor}
              stroke={item.borderColor}
              strokeWidth={sw}
            />
          </g>
        )
      }
    }
  }

  return (
    <div className="item-flowchart-container">
      <svg className="flowchart-svg" width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        {renderShape()}
      </svg>

      <div className="flowchart-label-wrap">
        {isInteractive ? (
          <textarea
            ref={inputRef}
            className="flowchart-editor"
            style={{ color: item.textColor, fontSize: `${item.fontSize}px` }}
            value={item.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onFinishInteract?.()
              }
              e.stopPropagation()
            }}
          />
        ) : (
          <span
            className="flowchart-label"
            style={{ color: item.textColor, fontSize: `${item.fontSize}px` }}
          >
            {item.label}
          </span>
        )}
      </div>
    </div>
  )
}
