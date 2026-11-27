import React, { useState } from 'react'
import type { ImageItem, ItemRendererProps } from '../types/board'

export const ImageItemView: React.FC<ItemRendererProps<ImageItem>> = ({ item, onUpdate }) => {
  const [failed, setFailed] = useState(false)

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget
    if (!item.naturalWidth && img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Snap initial placeholder size to the image's true aspect ratio
      const maxDim = Math.max(item.width, item.height, 340)
      const ratio = img.naturalWidth / img.naturalHeight
      const width = ratio >= 1 ? maxDim : Math.round(maxDim * ratio)
      const height = ratio >= 1 ? Math.round(maxDim / ratio) : maxDim
      onUpdate({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: Math.max(48, width),
        height: Math.max(48, height)
      })
    }
  }

  const cropStyle: React.CSSProperties = item.crop
    ? {
        clipPath: `inset(${item.crop.top * 100}% ${item.crop.right * 100}% ${item.crop.bottom * 100}% ${item.crop.left * 100}%)`
      }
    : {}

  if (failed) {
    return (
      <div className="item-fallback">
        <span>Image failed to load</span>
        <small>{item.name}</small>
      </div>
    )
  }

  return (
    <div className="item-image-container" style={cropStyle}>
      <img
        src={item.src}
        alt={item.name}
        draggable={false}
        onLoad={handleLoad}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          display: 'block',
          filter: item.grayscale ? 'grayscale(100%)' : undefined,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
    </div>
  )
}
