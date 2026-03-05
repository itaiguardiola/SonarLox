import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', {
    openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
    openMidiFile: () => ipcRenderer.invoke('open-midi-file'),
    openSoundFontFile: () => ipcRenderer.invoke('open-soundfont-file'),
    saveWavFile: (buffer: ArrayBuffer, defaultPath?: string) =>
      ipcRenderer.invoke('save-wav-file', buffer, defaultPath),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    saveWavFileToPath: (buffer: ArrayBuffer, filePath: string, expectedDir?: string) =>
      ipcRenderer.invoke('save-wav-file-to-path', buffer, filePath, expectedDir),
    saveProject: (data: {
      filePath: string
      manifest: string
      state: string
      timeline: string
      audioFiles: Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }>
    }) => ipcRenderer.invoke('project:save', data),
    openProject: () => ipcRenderer.invoke('project:open'),
    saveProjectDialog: () => ipcRenderer.invoke('project:save-dialog') as Promise<string | null>,
    showConfirmDialog: (options: {
      message: string
      detail?: string
      buttons?: string[]
      defaultId?: number
      cancelId?: number
    }) => ipcRenderer.invoke('show-confirm-dialog', options) as Promise<number>,
    scanPlugins: () => ipcRenderer.invoke('plugins:scan'),
    readPluginScript: (pluginId: string) => ipcRenderer.invoke('plugins:read-script', pluginId) as Promise<string | null>,
    getPluginsDir: () => ipcRenderer.invoke('plugins:get-dir') as Promise<string>,
  })
}
