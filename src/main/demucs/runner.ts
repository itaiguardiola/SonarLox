import { spawn, ChildProcess, execFile } from 'child_process'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import { readdir, readFile, rm, mkdir } from 'fs/promises'
import { app } from 'electron'
import { existsSync } from 'fs'
import type { SourcePosition } from '../../renderer/types'

export interface RunnerDemucsOptions {
  inputFilePath: string
  model: string
  device: string
  pythonPath?: string
}

export interface RunnerStemResult {
  name: string
  buffer: ArrayBuffer
  defaultPosition: SourcePosition
  color: string
}

export interface RunnerDemucsResult {
  success: boolean
  stems: RunnerStemResult[]
  error?: string
  durationMs: number
}

export interface ProbeResult {
  available: boolean
  gpuAvailable: boolean
  gpuType: 'cuda' | 'mps' | 'cpu'
  pythonPath: string | null
  version: string | null
}

const STEM_DEFAULTS: Record<string, { position: SourcePosition; color: string }> = {
  drums:  { position: [0,     0,   -3],   color: '#ff4444' },  // back center
  bass:   { position: [2.5,   0,   -4],   color: '#ff8800' },  // stage-left (audience right)
  vocals: { position: [0,     0.3, -5],   color: '#44aaff' },  // front center, elevated
  other:  { position: [-3,    0,   -4],   color: '#88ff44' },  // stage-right (audience left)
  guitar: { position: [-2,    0,   -3.5], color: '#ffdd00' },  // stage-right, offset
  piano:  { position: [3,     0,   -3.5], color: '#cc88ff' },  // stage-left, offset
}

let activeProcess: ChildProcess | null = null

function getProbePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'probe.py')
  }
  // In dev, __dirname is out/main/ which may not have the file copied.
  // Fall back to the source tree.
  const builtPath = join(__dirname, 'demucs', 'probe.py')
  if (existsSync(builtPath)) return builtPath
  return join(__dirname, '..', '..', 'src', 'main', 'demucs', 'probe.py')
}

async function findPython(): Promise<string | null> {
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']

  for (const cmd of candidates) {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        execFile(cmd, ['--version'], { timeout: 5000 }, (err, stdout, stderr) => {
          if (err) return reject(err)
          resolve((stdout || stderr).trim())
        })
      })
      if (result.includes('Python 3')) return cmd
    } catch {
      // try next candidate
    }
  }
  return null
}

export async function probeDemucs(): Promise<ProbeResult> {
  const pythonPath = await findPython()
  if (!pythonPath) {
    return { available: false, gpuAvailable: false, gpuType: 'cpu', pythonPath: null, version: null }
  }

  try {
    const probePath = getProbePath()
    const output = await new Promise<string>((resolve, reject) => {
      execFile(pythonPath, [probePath], { timeout: 15000 }, (err, stdout) => {
        if (err) return reject(err)
        resolve(stdout.trim())
      })
    })

    const data = JSON.parse(output) as { demucs: boolean; cuda: boolean; mps: boolean }
    const gpuType = data.cuda ? 'cuda' : data.mps ? 'mps' : 'cpu'

    return {
      available: data.demucs,
      gpuAvailable: data.cuda || data.mps,
      gpuType,
      pythonPath,
      version: null,
    }
  } catch {
    return { available: false, gpuAvailable: false, gpuType: 'cpu', pythonPath, version: null }
  }
}

function getStemsDir(): string {
  return join(tmpdir(), 'sonarlox-stems')
}

export async function runDemucs(
  options: RunnerDemucsOptions,
  onProgress: (percent: number, stage: string) => void
): Promise<RunnerDemucsResult> {
  const startTime = Date.now()
  const stemsRoot = getStemsDir()
  const outputDir = join(stemsRoot, Date.now().toString())
  await mkdir(outputDir, { recursive: true })

  const pythonPath = options.pythonPath ?? 'python'
  const args = [
    '-m', 'demucs',
    '--out', outputDir,
    '-n', options.model,
    '-d', options.device,
    options.inputFilePath,
  ]

  return new Promise((resolve) => {
    activeProcess = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stderrOutput = ''

    activeProcess.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      stderrOutput += line
      const match = line.match(/(\d+)%/)
      if (match) onProgress(parseInt(match[1]), 'separating')
    })

    activeProcess.on('close', async (code) => {
      activeProcess = null
      const durationMs = Date.now() - startTime

      if (code !== 0) {
        const isOom = stderrOutput.includes('out of memory') || stderrOutput.includes('CUDA out of memory')
        resolve({
          success: false,
          stems: [],
          error: isOom ? 'GPU out of memory' : `Demucs exited with code ${code}`,
          durationMs,
        })
        return
      }

      try {
        const stems = await readStemFiles(outputDir, options.inputFilePath)
        resolve({ success: true, stems, durationMs })
      } catch (err) {
        resolve({
          success: false,
          stems: [],
          error: `Failed to read stem files: ${err}`,
          durationMs,
        })
      }
    })

    activeProcess.on('error', (err) => {
      activeProcess = null
      resolve({
        success: false,
        stems: [],
        error: `Failed to spawn demucs: ${err.message}`,
        durationMs: Date.now() - startTime,
      })
    })
  })
}

async function readStemFiles(outputDir: string, inputFilePath: string): Promise<RunnerStemResult[]> {
  // Demucs writes to: outputDir/<model>/<trackname>/<stem>.wav
  const inputName = basename(inputFilePath).replace(/\.[^.]+$/, '')
  const modelDirs = await readdir(outputDir)
  if (modelDirs.length === 0) throw new Error('No model output directory found')

  const trackDir = join(outputDir, modelDirs[0], inputName)
  const files = await readdir(trackDir)
  const stems: RunnerStemResult[] = []

  for (const file of files) {
    if (!file.endsWith('.wav')) continue
    const stemName = file.replace('.wav', '')
    const defaults = STEM_DEFAULTS[stemName] ?? {
      position: [0, 0, -2] as SourcePosition,
      color: '#cccccc',
    }
    const nodeBuffer = await readFile(join(trackDir, file))
    const arrayBuffer = nodeBuffer.buffer.slice(
      nodeBuffer.byteOffset,
      nodeBuffer.byteOffset + nodeBuffer.byteLength
    )
    stems.push({
      name: stemName,
      buffer: arrayBuffer,
      defaultPosition: defaults.position,
      color: defaults.color,
    })
  }

  return stems
}

export function cancelDemucs(): void {
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }
}

export async function installDemucs(
  pythonPath?: string,
  onOutput?: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  const cmd = pythonPath ?? 'python'
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['-m', 'pip', 'install', '-U', 'demucs'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stderr = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      onOutput?.(text)
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      onOutput?.(text)
    })
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true })
      else resolve({ success: false, error: stderr || `pip exited with code ${code}` })
    })
    proc.on('error', (err) => {
      resolve({ success: false, error: `Failed to run pip: ${err.message}` })
    })
  })
}

export async function cleanupStemDirs(): Promise<void> {
  try {
    const stemsRoot = getStemsDir()
    await rm(stemsRoot, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
}
