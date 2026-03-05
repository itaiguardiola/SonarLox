import { ipcMain, dialog } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import { saveProject, openProject } from './projectIO'
import { scanPlugins, readPluginScript, getPluginsDir, importPlugin, removePlugin, openPluginsFolder } from './pluginScanner'

ipcMain.handle('save-wav-file', async (_event, wavBuffer: ArrayBuffer, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
    defaultPath: defaultPath ?? 'export.wav'
  })
  if (result.canceled || !result.filePath) return { saved: false }
  await writeFile(result.filePath, Buffer.from(wavBuffer))
  return { saved: true, path: result.filePath }
})

ipcMain.handle('open-audio-file', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  const nodeBuffer = await readFile(result.filePaths[0])
  const arrayBuffer = nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength
  )
  return { buffer: arrayBuffer, name: result.filePaths[0].split(/[\\/]/).pop() }
})

ipcMain.handle('open-midi-file', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  const nodeBuffer = await readFile(result.filePaths[0])
  const arrayBuffer = nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength
  )
  return { buffer: arrayBuffer, name: result.filePaths[0].split(/[\\/]/).pop() }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
})

ipcMain.handle(
  'save-wav-file-to-path',
  async (_event, wavBuffer: ArrayBuffer, filePath: string, expectedDir?: string) => {
    try {
      const resolved = resolve(filePath)
      if (expectedDir) {
        const resolvedDir = resolve(expectedDir)
        if (!resolved.startsWith(resolvedDir + '\\') && !resolved.startsWith(resolvedDir + '/')) {
          console.error('Path traversal blocked:', resolved, 'not in', resolvedDir)
          return { saved: false }
        }
      }
      await mkdir(dirname(resolved), { recursive: true })
      await writeFile(resolved, Buffer.from(wavBuffer))
      return { saved: true, path: resolved }
    } catch (err) {
      console.error('Failed to save WAV file:', err)
      return { saved: false }
    }
  }
)

// Project save/open handlers
ipcMain.handle('project:save', async (_event, data: {
  filePath: string
  manifest: string
  state: string
  timeline: string
  audioFiles: Array<{ name: string; wavBuffer: ArrayBuffer; meta: string }>
}) => {
  try {
    const resolved = resolve(data.filePath)
    await mkdir(dirname(resolved), { recursive: true })
    return await saveProject({ ...data, filePath: resolved })
  } catch (err) {
    console.error('Failed to save project:', err)
    return { saved: false, path: '' }
  }
})

ipcMain.handle('project:open', async () => {
  const result = await dialog.showOpenDialog({
    filters: [
      { name: 'SonarLox Project', extensions: ['sonarlox'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  try {
    const data = await openProject(result.filePaths[0])
    return { ...data, filePath: result.filePaths[0] }
  } catch (err) {
    console.error('Failed to open project:', err)
    return null
  }
})

ipcMain.handle('project:save-dialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'SonarLox Project', extensions: ['sonarlox'] }],
    defaultPath: 'untitled.sonarlox'
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
})

ipcMain.handle('show-confirm-dialog', async (_event, options: {
  message: string
  detail?: string
  buttons?: string[]
  defaultId?: number
  cancelId?: number
}) => {
  const { BrowserWindow } = await import('electron')
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showMessageBox(win!, {
    type: 'question',
    message: options.message,
    detail: options.detail,
    buttons: options.buttons ?? ['OK', 'Cancel'],
    defaultId: options.defaultId ?? 0,
    cancelId: options.cancelId ?? 1,
  })
  return result.response
})

// Plugin system handlers
ipcMain.handle('plugins:scan', async () => {
  return await scanPlugins()
})

ipcMain.handle('plugins:read-script', async (_event, pluginId: string) => {
  return await readPluginScript(pluginId)
})

ipcMain.handle('plugins:get-dir', async () => {
  return getPluginsDir()
})

ipcMain.handle('plugins:import', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Plugin Folder',
  })
  if (result.canceled || !result.filePaths.length) return null
  return await importPlugin(result.filePaths[0])
})

ipcMain.handle('plugins:remove', async (_event, pluginId: string) => {
  return await removePlugin(pluginId)
})

ipcMain.handle('plugins:open-folder', async () => {
  await openPluginsFolder()
})

ipcMain.handle('open-video-file', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  const filePath = result.filePaths[0]
  const name = filePath.split(/[\\/]/).pop() || 'video'
  return { filePath, name }
})

ipcMain.handle('open-soundfont-file', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'SoundFont', extensions: ['sf2'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths.length) return null
  const nodeBuffer = await readFile(result.filePaths[0])
  const arrayBuffer = nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength
  )
  return { buffer: arrayBuffer, name: result.filePaths[0].split(/[\\/]/).pop() }
})
