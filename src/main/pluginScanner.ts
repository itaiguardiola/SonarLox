import { app, shell } from 'electron'
import { readdir, readFile, stat, mkdir, cp, rm } from 'fs/promises'
import { join, basename } from 'path'

interface PluginParameterDef {
  id: string
  label: string
  type: 'float' | 'int' | 'boolean' | 'select'
  defaultValue: number | boolean | string
  min?: number
  max?: number
  step?: number
  options?: string[]
}

interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  type: 'audio-effect' | 'visualizer' | 'exporter' | 'source-generator'
  main: string
  parameters: PluginParameterDef[]
}

/** Returns the plugins directory path inside app userData */
export function getPluginsDir(): string {
  return join(app.getPath('userData'), 'plugins')
}

/** Ensures the plugins directory exists, creating it if needed */
export async function ensurePluginsDir(): Promise<void> {
  const dir = getPluginsDir()
  await mkdir(dir, { recursive: true })
}

/** Scans the plugins directory for valid plugin manifests */
export async function scanPlugins(): Promise<PluginManifest[]> {
  await ensurePluginsDir()
  const dir = getPluginsDir()
  const manifests: PluginManifest[] = []

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return manifests
  }

  for (const entry of entries) {
    const pluginDir = join(dir, entry)
    try {
      const info = await stat(pluginDir)
      if (!info.isDirectory()) continue

      const manifestPath = join(pluginDir, 'plugin.json')
      const raw = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>

      if (!parsed.id || !parsed.name || !parsed.type || !parsed.main) continue

      const validTypes = ['audio-effect', 'visualizer', 'exporter', 'source-generator']
      if (!validTypes.includes(parsed.type as string)) continue

      const manifest: PluginManifest = {
        id: parsed.id as string,
        name: parsed.name as string,
        version: (parsed.version as string) ?? '0.0.0',
        description: (parsed.description as string) ?? '',
        author: (parsed.author as string) ?? '',
        type: parsed.type as PluginManifest['type'],
        main: parsed.main as string,
        parameters: Array.isArray(parsed.parameters)
          ? (parsed.parameters as PluginParameterDef[])
          : [],
      }
      manifests.push(manifest)
    } catch {
      // Skip invalid plugin directories
    }
  }

  return manifests
}

/** Imports a plugin directory into the plugins folder */
export async function importPlugin(sourcePath: string): Promise<PluginManifest | null> {
  await ensurePluginsDir()
  const dir = getPluginsDir()

  // Validate source has a plugin.json
  const manifestPath = join(sourcePath, 'plugin.json')
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf-8')
  } catch {
    return null
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>
  if (!parsed.id || !parsed.name || !parsed.type || !parsed.main) return null

  const destName = basename(sourcePath)
  const destPath = join(dir, destName)

  await cp(sourcePath, destPath, { recursive: true })

  return {
    id: parsed.id as string,
    name: parsed.name as string,
    version: (parsed.version as string) ?? '0.0.0',
    description: (parsed.description as string) ?? '',
    author: (parsed.author as string) ?? '',
    type: parsed.type as PluginManifest['type'],
    main: parsed.main as string,
    parameters: Array.isArray(parsed.parameters)
      ? (parsed.parameters as PluginParameterDef[])
      : [],
  }
}

/** Removes a plugin directory from the plugins folder */
export async function removePlugin(pluginId: string): Promise<boolean> {
  await ensurePluginsDir()
  const dir = getPluginsDir()

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return false
  }

  for (const entry of entries) {
    const pluginDir = join(dir, entry)
    try {
      const manifestPath = join(pluginDir, 'plugin.json')
      const raw = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.id === pluginId) {
        await rm(pluginDir, { recursive: true, force: true })
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

/** Opens the plugins directory in the OS file explorer */
export async function openPluginsFolder(): Promise<void> {
  await ensurePluginsDir()
  const dir = getPluginsDir()
  await shell.openPath(dir)
}

/** Reads the main JS file for a given plugin ID */
export async function readPluginScript(pluginId: string): Promise<string | null> {
  await ensurePluginsDir()
  const dir = getPluginsDir()

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const pluginDir = join(dir, entry)
    try {
      const manifestPath = join(pluginDir, 'plugin.json')
      const raw = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>

      if (parsed.id !== pluginId) continue
      if (!parsed.main) return null

      const scriptPath = join(pluginDir, parsed.main as string)
      return await readFile(scriptPath, 'utf-8')
    } catch {
      continue
    }
  }

  return null
}
