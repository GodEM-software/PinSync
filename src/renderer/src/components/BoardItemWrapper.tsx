import React from 'react'
import { Lock } from 'lucide-react'
import type { BoardItem } from '../types/board'
import { BoardItemContent } from '../items/registry'

interface BoardItemWrapperProps {
  item: BoardItem
  isSelected: boolean
  isInteractive: boolean
  cropDraft: { left: number; top: number; right: number; bottom: number } | null
  onMouseDown: (e: React.MouseEvent, item: BoardItem) => void
  onDoubleClick: (e: React.MouseEvent, item: BoardItem) => void
  onContextMenu: (e: React.MouseEvent, item: BoardItem) => void
  onUpdate: (id: string, patch: Partial<BoardItem>) => void
  onRequestInteract: (id: string) => void
  onFinishInteract: () => void
  onTriggerArrowFromText: (item: BoardItem) => void
  onStartArrowFromPort: (worldX: number, worldY: number) => void
}

export const BoardItemWrapper: React.FC<BoardItemWrapperProps> = ({
  item,
  isSelected,
  isInteractive,
  cropDraft,
  onMouseDown,
  onDoubleClick,
  onContextMenu,
  onUpdate,
  onRequestInteract,
  onFinishInteract,
  onTriggerArrowFromText,
  onStartArrowFromPort
}) => {
  const flipTransform = `scale(${item.flipX ? -1 : 1}, ${item.flipY ? -1 : 1})`
  const isTransparentFrame =
    item.type === 'arrow' ||
    item.type === 'text' ||
    item.type === 'flowchart' ||
    item.type === 'drawing'

  const showPorts = isSelected && !isInteractive && item.type === 'flowchart' && !item.locked

  return (
    <div
      className={`board-item ${isTransparentFrame ? 'frameless-item' : ''} ${isSelected ? 'selected' : ''} ${isInteractive ? 'interactive' : ''} ${item.locked ? 'locked' : ''}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        opacity: item.opacity,
        transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`
      }}
      onMouseDown={(e) => onMouseDown(e, item)}
      onDoubleClick={(e) => onDoubleClick(e, item)}
      onContextMenu={(e) => onContextMenu(e, item)}
    >
      <div
        className={`board-item-inner ${isTransparentFrame ? 'transparent-bg' : ''}`}
        style={{ transform: flipTransform }}
      >
        <BoardItemContent
          item={item}
          isSelected={isSelected}
          isInteractive={isInteractive}
          onUpdate={(patch) => onUpdate(item.id, patch)}
          onRequestInteract={() => onRequestInteract(item.id)}
          onFinishInteract={onFinishInteract}
          onTriggerArrowFromText={() => onTriggerArrowFromText(item)}
        />
      </div>

      {showPorts && (
        <>
          <button
            type="button"
            className="flow-port flow-port-top"
            title="Start arrow from top"
            onMouseDown={(e) => {
              e.stopPropagation()
              onStartArrowFromPort(item.x, item.y - item.height / 2)
            }}
          />
          <button
            type="button"
            className="flow-port flow-port-right"
            title="Start arrow from right"
            onMouseDown={(e) => {
              e.stopPropagation()
              onStartArrowFromPort(item.x + item.width / 2, item.y)
            }}
          />
          <button
            type="button"
            className="flow-port flow-port-bottom"
            title="Start arrow from bottom"
            onMouseDown={(e) => {
              e.stopPropagation()
              onStartArrowFromPort(item.x, item.y + item.height / 2)
            }}
          />
          <button
            type="button"
            className="flow-port flow-port-left"
            title="Start arrow from left"
            onMouseDown={(e) => {
              e.stopPropagation()
              onStartArrowFromPort(item.x - item.width / 2, item.y)
            }}
          />
        </>
      )}

      {cropDraft && (
        <div
          className="crop-draft-box"
          style={{
            left: `${cropDraft.left * 100}%`,
            top: `${cropDraft.top * 100}%`,
            width: `${(1 - cropDraft.left - cropDraft.right) * 100}%`,
            height: `${(1 - cropDraft.top - cropDraft.bottom) * 100}%`
          }}
        />
      )}

      {item.locked && (
        <div className="item-lock-badge" title="Locked (Alt+L to unlock)">
          <Lock size={11} />
        </div>
      )}
    </div>
  )
}
