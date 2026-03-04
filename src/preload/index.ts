import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', {
    openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
    saveWavFile: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-wav-file', buffer)
  })
}
