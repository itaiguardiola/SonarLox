import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'

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
