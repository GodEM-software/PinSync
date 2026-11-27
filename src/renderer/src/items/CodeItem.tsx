import React, { useMemo, useState } from 'react'
import { Check, Code2, Copy, WrapText } from 'lucide-react'
import type { CodeItem, ItemRendererProps } from '../types/board'

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'class',
  'interface',
  'type',
  'enum',
  'extends',
  'implements',
  'async',
  'await',
  'try',
  'catch',
  'throw',
  'new',
  'true',
  'false',
  'null',
  'undefined',
  'def',
  'fn',
  'pub',
  'struct',
  'impl',
  'use',
  'match',
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'ORDER',
  'BY'
])

type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'number'

interface Token {
  kind: TokenKind
  text: string
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  const regex =
    /(\/\/.*$|#.*$)|(["'`])(?:\\.|(?!\2).)*\2|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'plain', text: line.slice(lastIndex, match.index) })
    }
    if (match[1]) {
      tokens.push({ kind: 'comment', text: match[1] })
    } else if (match[2]) {
      tokens.push({ kind: 'string', text: match[0] })
    } else if (match[3]) {
      tokens.push({ kind: 'number', text: match[3] })
    } else if (match[4]) {
      tokens.push({
        kind: KEYWORDS.has(match[4]) ? 'keyword' : 'plain',
        text: match[4]
      })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < line.length) {
    tokens.push({ kind: 'plain', text: line.slice(lastIndex) })
  }
  return tokens.length > 0 ? tokens : [{ kind: 'plain', text: ' ' }]
}

export const CodeItemView: React.FC<ItemRendererProps<CodeItem>> = ({
  item,
  isInteractive,
  onUpdate,
  onFinishInteract
}) => {
  const [copied, setCopied] = useState(false)

  const highlightedLines = useMemo(() => {
    const rawLines = item.code.split(/\r?\n/)
    // Cap tokenization at 400 lines to keep large drops instant
    return rawLines.slice(0, 400).map((line) => tokenizeLine(line))
  }, [item.code])

  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void navigator.clipboard?.writeText(item.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="item-code-container">
      <div
        className="code-header"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="code-lang-pill">
          <Code2 size={12} />
          <span>{item.language.toUpperCase()}</span>
        </div>
        <span className="code-title" title={item.filePath || item.name}>
          {item.name}
        </span>
        <button
          className={`media-btn ${item.wordWrap ? 'active' : ''}`}
          title="Toggle Word Wrap"
          onClick={() => onUpdate({ wordWrap: !item.wordWrap })}
        >
          <WrapText size={12} />
        </button>
        <button className="media-btn" title="Copy Code" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      {isInteractive ? (
        <textarea
          className="code-editor"
          style={{ fontSize: `${item.fontSize}px` }}
          value={item.code}
          onChange={(e) => onUpdate({ code: e.target.value })}
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
        <div
          className={`code-scroll ${item.wordWrap ? 'wrap' : ''}`}
          style={{ fontSize: `${item.fontSize}px` }}
        >
          <pre className="code-pre">
            {highlightedLines.map((tokens, idx) => (
              <div key={idx} className="code-line">
                {item.showLineNumbers && <span className="code-ln">{idx + 1}</span>}
                <span className="code-txt">
                  {tokens.map((tok, ti) => (
                    <span key={ti} className={`tok-${tok.kind}`}>
                      {tok.text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  )
}
