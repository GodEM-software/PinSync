import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type MediaOpenKind = 'all' | 'image' | 'video' | 'sound' | 'model3d' | 'code'

export interface ClipboardReadResult {
  kind: 'image' | 'text'
  dataUrl?: string
  width?: number
  height?: number
  text?: string
}

export const api = {
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: (): Promise<boolean> => ipcRenderer.invoke('window:maximize-toggle'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (flag: boolean): Promise<boolean> =>
    ipcRenderer.invoke('window:set-always-on-top', flag),
  setWindowOpacity: (opacity: number): Promise<number> =>
    ipcRenderer.invoke('window:set-opacity', opacity),
  onMaximizedChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, val: boolean): void => callback(val)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => ipcRenderer.removeListener('window:maximized-changed', handler)
  },
  startWindowDrag: (): void => ipcRenderer.send('window:drag-start'),
  moveWindowDrag: (): void => ipcRenderer.send('window:drag-move'),
  endWindowDrag: (): void => ipcRenderer.send('window:drag-end'),
  openMediaDialog: (kind?: MediaOpenKind): Promise<string[]> =>
    ipcRenderer.invoke('dialog:open-files', kind),
  readTextFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:read-text-file', filePath),
  parseCadFile: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('cad:parse-file', filePath),
  saveBoard: (payload: { filePath?: string; content: string }): Promise<string | null> =>
    ipcRenderer.invoke('board:save', payload),
  openBoard: (): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('board:open'),
  saveAutosave: (content: string): Promise<boolean> =>
    ipcRenderer.invoke('board:autosave-save', content),
  loadAutosave: (): Promise<string | null> => ipcRenderer.invoke('board:autosave-load'),
  exportPng: (): Promise<string | null> => ipcRenderer.invoke('board:export-png'),
  readClipboard: (): Promise<ClipboardReadResult | null> => ipcRenderer.invoke('clipboard:read'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  startNativeDragOut: (payload: {
    type: string
    name?: string
    src?: string
    filePath?: string
    textContent?: string
    svgContent?: string
  }): void => ipcRenderer.send('item:native-drag-out', payload),
  getCentralServerStatus: (): Promise<{ running: boolean; port: number; urls: string[] }> =>
    ipcRenderer.invoke('server:status'),
  startCentralServer: (
    port?: number
  ): Promise<{ running: boolean; port: number; urls: string[] }> =>
    ipcRenderer.invoke('server:start', port),
  stopCentralServer: (): Promise<{ running: boolean; port: number; urls: string[] }> =>
    ipcRenderer.invoke('server:stop'),
  syncAssetsUp: (serverUrl: string, items: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke('online:sync-assets-up', { serverUrl, items }),
  syncAssetsDown: (serverUrl: string, items: unknown[]): Promise<unknown[]> =>
    ipcRenderer.invoke('online:sync-assets-down', { serverUrl, items }),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
