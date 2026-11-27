import { useCallback, useRef, useState } from 'react'
import type { BoardItem } from '../types/board'

const MAX_HISTORY = 60

export interface BoardHistoryApi {
  items: BoardItem[]
  commit: (updater: BoardItem[] | ((prev: BoardItem[]) => BoardItem[])) => void
  setTransient: (updater: BoardItem[] | ((prev: BoardItem[]) => BoardItem[])) => void
  snapshotBeforeDrag: (snapshot: BoardItem[]) => void
  undo: () => void
  redo: () => void
  resetHistory: (nextItems: BoardItem[]) => void
}

export function useBoardHistory(initialItems: BoardItem[] = []): BoardHistoryApi {
  const [items, setItems] = useState<BoardItem[]>(initialItems)
  const pastRef = useRef<BoardItem[][]>([])
  const futureRef = useRef<BoardItem[][]>([])

  const commit = useCallback((updater: BoardItem[] | ((prev: BoardItem[]) => BoardItem[])) => {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next === prev) return prev
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev]
      futureRef.current = []
      return next
    })
  }, [])

  const setTransient = useCallback(
    (updater: BoardItem[] | ((prev: BoardItem[]) => BoardItem[])) => {
      setItems(updater)
    },
    []
  )

  const snapshotBeforeDrag = useCallback((snapshot: BoardItem[]) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot]
    futureRef.current = []
  }, [])

  const undo = useCallback(() => {
    setItems((current) => {
      if (pastRef.current.length === 0) return current
      const previous = pastRef.current[pastRef.current.length - 1]
      pastRef.current = pastRef.current.slice(0, -1)
      futureRef.current = [current, ...futureRef.current.slice(0, MAX_HISTORY - 1)]
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    setItems((current) => {
      if (futureRef.current.length === 0) return current
      const next = futureRef.current[0]
      futureRef.current = futureRef.current.slice(1)
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), current]
      return next
    })
  }, [])

  const resetHistory = useCallback((nextItems: BoardItem[]) => {
    pastRef.current = []
    futureRef.current = []
    setItems(nextItems)
  }, [])

  return {
    items,
    commit,
    setTransient,
    snapshotBeforeDrag,
    undo,
    redo,
    resetHistory
  }
}
