import React from 'react'
import type { BoardItem, ItemRendererProps } from '../types/board'
import { ImageItemView } from './ImageItem'
import { VideoItemView } from './VideoItem'
import { WebpageItemView } from './WebpageItem'
import { SoundItemView } from './SoundItem'
import { Model3DItemView } from './Model3DItem'
import { TextItemView } from './TextItem'
import { FlowchartItemView } from './FlowchartItem'
import { ArrowItemView } from './ArrowItem'
import { CodeItemView } from './CodeItem'
import { SwatchItemView } from './SwatchItem'
import { DrawingItemView } from './DrawingItem'

export const BoardItemContent: React.FC<ItemRendererProps<BoardItem>> = (props) => {
  switch (props.item.type) {
    case 'image':
      return (
        <ImageItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'image' }>>)} />
      )
    case 'video':
      return (
        <VideoItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'video' }>>)} />
      )
    case 'webpage':
      return (
        <WebpageItemView
          {...(props as ItemRendererProps<Extract<BoardItem, { type: 'webpage' }>>)}
        />
      )
    case 'sound':
      return (
        <SoundItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'sound' }>>)} />
      )
    case 'model3d':
      return (
        <Model3DItemView
          {...(props as ItemRendererProps<Extract<BoardItem, { type: 'model3d' }>>)}
        />
      )
    case 'text':
      return (
        <TextItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'text' }>>)} />
      )
    case 'flowchart':
      return (
        <FlowchartItemView
          {...(props as ItemRendererProps<Extract<BoardItem, { type: 'flowchart' }>>)}
        />
      )
    case 'arrow':
      return (
        <ArrowItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'arrow' }>>)} />
      )
    case 'code':
      return (
        <CodeItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'code' }>>)} />
      )
    case 'swatch':
      return (
        <SwatchItemView {...(props as ItemRendererProps<Extract<BoardItem, { type: 'swatch' }>>)} />
      )
    case 'drawing':
      return (
        <DrawingItemView
          {...(props as ItemRendererProps<Extract<BoardItem, { type: 'drawing' }>>)}
        />
      )
  }
}
