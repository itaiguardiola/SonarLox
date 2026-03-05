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
      ipcRenderer.invoke('save-wav-file-to-path', buffer, filePath, expectedDir)
  })
}
