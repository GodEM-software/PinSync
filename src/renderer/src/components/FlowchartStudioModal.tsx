import React, { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Connection,
  type Edge,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Check, Plus, Trash2, Workflow, X } from 'lucide-react'

interface FlowchartStudioModalProps {
  onClose: () => void
  onPinGraphToBoard: (dataUrl: string, width: number, height: number, title: string) => void
}

const INITIAL_NODES: Node[] = [
  {
    id: '1',
    position: { x: 100, y: 80 },
    data: { label: 'Start / Idea' },
    style: {
      background: '#1e3a8a',
      color: '#f8fafc',
      border: '1.5px solid #60a5fa',
      borderRadius: 999,
      padding: '10px 18px',
      fontWeight: 600
    }
  },
  {
    id: '2',
    position: { x: 340, y: 80 },
    data: { label: 'Process / Design' },
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1.5px solid #38bdf8',
      borderRadius: 10,
      padding: '10px 18px',
      fontWeight: 600
    }
  },
  {
    id: '3',
    position: { x: 590, y: 80 },
    data: { label: 'Sync & Export' },
    style: {
      background: '#064e3b',
      color: '#f8fafc',
      border: '1.5px solid #34d399',
      borderRadius: 10,
      padding: '10px 18px',
      fontWeight: 600
    }
  }
]

const INITIAL_EDGES: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { stroke: '#60a5fa', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' }
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    style: { stroke: '#34d399', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#34d399' }
  }
]

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildGraphSvgDataUrl(
  nodes: Node[],
  edges: Edge[]
): { dataUrl: string; width: number; height: number } {
  if (nodes.length === 0) {
    return {
      dataUrl:
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"></svg>',
      width: 300,
      height: 160
    }
  }
  const nodeW = 165
  const nodeH = 48
  const pad = 44
  const xs = nodes.map((n) => n.position.x)
  const ys = nodes.map((n) => n.position.y)
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const maxX = Math.max(...xs) + nodeW + pad
  const maxY = Math.max(...ys) + nodeH + pad
  const width = Math.max(320, Math.round(maxX - minX))
  const height = Math.max(200, Math.round(maxY - minY))

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edgeSvg = edges
    .map((e) => {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      if (!s || !t) return ''
      const x1 = s.position.x - minX + nodeW / 2
      const y1 = s.position.y - minY + nodeH / 2
      const x2 = t.position.x - minX + nodeW / 2
      const y2 = t.position.y - minY + nodeH / 2
      const color = (e.style?.stroke as string) || '#60a5fa'
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5" marker-end="url(#rf-arrow)" />`
    })
    .join('')

  const nodeSvg = nodes
    .map((n) => {
      const x = n.position.x - minX
      const y = n.position.y - minY
      const bg = (n.style?.background as string) || '#1e293b'
      const border =
        ((n.style?.border as string) || '').match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#60a5fa'
      const rx = n.style?.borderRadius === 999 ? 24 : 10
      const label = escapeXml(String((n.data as { label?: string })?.label || 'Node'))
      return `<g transform="translate(${x},${y})"><rect width="${nodeW}" height="${nodeH}" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="2"/><text x="${nodeW / 2}" y="${nodeH / 2 + 5}" fill="#f8fafc" font-family="Inter,Segoe UI,sans-serif" font-size="13" font-weight="600" text-anchor="middle">${label}</text></g>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="rf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#60a5fa"/></marker></defs><rect width="${width}" height="${height}" rx="14" fill="#111520" stroke="#2d3648" stroke-width="2"/>${edgeSvg}${nodeSvg}</svg>`
  return {
    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width,
    height
  }
}

export const FlowchartStudioModal: React.FC<FlowchartStudioModalProps> = ({
  onClose,
  onPinGraphToBoard
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)
  const [newLabel, setNewLabel] = useState('New Step')
  const [newColor, setNewColor] = useState('#1e293b')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: '#60a5fa', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' }
          },
          eds
        )
      ),
    [setEdges]
  )

  const handleAddNode = (pill = false): void => {
    const id = `n_${Date.now().toString(36)}`
    const node: Node = {
      id,
      position: { x: 160 + (nodes.length % 4) * 60, y: 160 + Math.floor(nodes.length / 4) * 70 },
      data: { label: newLabel.trim() || 'Step' },
      style: {
        background: newColor,
        color: '#f8fafc',
        border: '1.5px solid #60a5fa',
        borderRadius: pill ? 999 : 10,
        padding: '10px 18px',
        fontWeight: 600
      }
    }
    setNodes((prev) => [...prev, node])
  }

  const handleDeleteSelected = (): void => {
    if (!selectedNodeId) return
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId))
    setEdges((prev) =>
      prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    )
    setSelectedNodeId(null)
  }

  const handlePinToBoard = (): void => {
    const { dataUrl, width, height } = buildGraphSvgDataUrl(nodes, edges)
    onPinGraphToBoard(dataUrl, Math.min(640, width), Math.min(460, height), 'React Flow Graph')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          width: 'min(1040px, 94vw)',
          height: 'min(680px, 88vh)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            <Workflow size={16} color="#38bdf8" />
            <span>React Flow Studio (Interactive Flowchart &amp; Graph)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-primary small" onClick={handlePinToBoard}>
              <Check size={13} /> Pin Graph to Board
            </button>
            <button className="win-btn tiny" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="rf-toolbar">
          <input
            className="fp-input"
            style={{ maxWidth: 190 }}
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value)
              if (selectedNodeId) {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === selectedNodeId
                      ? { ...n, data: { ...n.data, label: e.target.value } }
                      : n
                  )
                )
              }
            }}
            placeholder="Node label..."
          />
          <input
            type="color"
            className="fp-color-input"
            value={newColor}
            onChange={(e) => {
              setNewColor(e.target.value)
              if (selectedNodeId) {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === selectedNodeId
                      ? { ...n, style: { ...n.style, background: e.target.value } }
                      : n
                  )
                )
              }
            }}
            title="Node fill color"
          />
          <button className="btn-secondary small" onClick={() => handleAddNode(false)}>
            <Plus size={12} /> Add Step
          </button>
          <button className="btn-secondary small" onClick={() => handleAddNode(true)}>
            <Plus size={12} /> Add Pill
          </button>
          {selectedNodeId && (
            <button className="btn-secondary small" onClick={handleDeleteSelected}>
              <Trash2 size={12} /> Delete Node
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
            Drag from node handles to connect · Click node to edit label &amp; color
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, background: '#0e1118' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id)
              setNewLabel(String((node.data as { label?: string })?.label || ''))
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background color="#252c3d" gap={20} />
            <Controls />
            <MiniMap style={{ background: '#141824' }} nodeColor="#3b82f6" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
