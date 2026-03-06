import './ipc'
import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join, resolve, dirname } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { cancelDemucs, cleanupStemDirs, probeDemucs, runDemucs } from './demucs/runner'
import { writeFile, mkdir } from 'fs/promises'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sonarlox-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    }
  }
])

async function handleCli(): Promise<boolean> {
  const args = process.argv.slice(app.isPackaged ? 1 : 2)
  
  // --separate <input> [--out <dir>] [--model <model>] [--device <device>]
  const separateIdx = args.indexOf('--separate')
  if (separateIdx !== -1) {
    const input = args[separateIdx + 1]
    if (!input) {
      console.error('Error: Missing input file for --separate')
      app.exit(1)
      return true
    }

    const outIdx = args.indexOf('--out')
    const outDir = outIdx !== -1 ? args[outIdx + 1] : dirname(resolve(input))
    
    const modelIdx = args.indexOf('--model')
    const model = modelIdx !== -1 ? args[modelIdx + 1] : 'htdemucs'
    
    const deviceIdx = args.indexOf('--device')
    const device = deviceIdx !== -1 ? args[deviceIdx + 1] : 'cpu'

    console.log(`SonarLox CLI: Separating stems...`)
    console.log(`Input:  ${input}`)
    console.log(`Output: ${outDir}`)
    console.log(`Model:  ${model}`)
    console.log(`Device: ${device}`)

    try {
      const probe = await probeDemucs()
      if (!probe.available) {
        console.error('Error: Demucs not found. Please install it first.')
        app.exit(1)
        return true
      }

      const result = await runDemucs({
        inputFilePath: resolve(input),
        model,
        device,
        pythonPath: probe.pythonPath ?? undefined
      }, (percent, stage) => {
        process.stdout.write(`\rProgress: ${percent}% [${stage}]`)
      })

      process.stdout.write('\n')

      if (result.success) {
        await mkdir(outDir, { recursive: true })
        for (const stem of result.stems) {
          const stemPath = join(outDir, `${stem.name}.wav`)
          await writeFile(stemPath, Buffer.from(stem.buffer))
          console.log(`Saved: ${stemPath}`)
        }
        console.log('Stem separation completed successfully.')
        app.exit(0)
      } else {
        console.error(`Error: ${result.error}`)
        app.exit(1)
      }
    } catch (err) {
      console.error(`Error: ${err}`)
      app.exit(1)
    }
    return true
  }

  return false
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'SonarLox',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  const isCli = await handleCli()
  if (isCli) return

  protocol.handle('sonarlox-video', (request) => {
    const url = new URL(request.url)
    const filePath = url.searchParams.get('path')
    if (!filePath) {
      return new Response('Missing path parameter', { status: 400 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  cancelDemucs()
  cleanupStemDirs().catch(() => {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
