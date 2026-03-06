import { createWriteStream } from 'fs'
import { readFile } from 'fs/promises'
import archiver from 'archiver'
import yauzl from 'yauzl'

interface AudioFileEntry {
  name: string
  wavBuffer: ArrayBuffer
  meta: string
}

interface ProjectSaveInput {
  filePath: string
  manifest: string
  state: string
  timeline: string
  audioFiles: AudioFileEntry[]
}

interface AudioFileOutput {
  name: string
  buffer: ArrayBuffer
  meta: Record<string, unknown>
}

interface ProjectOpenResult {
  manifest: Record<string, unknown>
  state: Record<string, unknown>
  timeline: Record<string, unknown>
  audioFiles: AudioFileOutput[]
}

export async function saveProject(data: ProjectSaveInput): Promise<{ saved: boolean; path: string }> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(data.filePath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve({ saved: true, path: data.filePath }))
    archive.on('error', (err) => reject(err))

    archive.pipe(output)

    archive.append(data.manifest, { name: 'manifest.json' })
    archive.append(data.state, { name: 'state.json' })
    archive.append(data.timeline, { name: 'timeline.json' })

    for (const af of data.audioFiles) {
      archive.append(Buffer.from(af.wavBuffer), { name: `audio/${af.name}` })
      const ext = af.name.endsWith('.mid') ? '.mid' : '.wav'
      archive.append(af.meta, { name: `audio/${af.name.replace(ext, '.meta.json')}` })
    }

    archive.finalize()
  })
}

export async function openProject(filePath: string): Promise<ProjectOpenResult> {
  const fileBuffer = await readFile(filePath)

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(fileBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Failed to open ZIP'))

      const entries: Map<string, Buffer> = new Map()
      let remaining = zipfile.entryCount

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          remaining--
          if (remaining === 0) finalize()
          else zipfile.readEntry()
          return
        }

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            remaining--
            if (remaining === 0) finalize()
            else zipfile.readEntry()
            return
          }

          const chunks: Buffer[] = []
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          readStream.on('end', () => {
            entries.set(entry.fileName, Buffer.concat(chunks))
            remaining--
            if (remaining === 0) finalize()
            else zipfile.readEntry()
          })
        })
      })

      zipfile.on('error', reject)

      function finalize(): void {
        const manifestBuf = entries.get('manifest.json')
        if (!manifestBuf) return reject(new Error('Missing manifest.json'))

        const manifest = JSON.parse(manifestBuf.toString('utf-8'))
        if (manifest.format !== 'sonarlox-project') {
          return reject(new Error('Not a SonarLox project file'))
        }

        const majorVersion = parseInt(manifest.version?.split('.')[0] ?? '0')
        if (majorVersion > 1) {
          return reject(new Error(`Unsupported format version ${manifest.version}. Please update SonarLox.`))
        }

        const stateBuf = entries.get('state.json')
        const state = stateBuf ? JSON.parse(stateBuf.toString('utf-8')) : {}

        const timelineBuf = entries.get('timeline.json')
        const timeline = timelineBuf ? JSON.parse(timelineBuf.toString('utf-8')) : { version: '1.0.0', tracks: [] }

        const audioFiles: AudioFileOutput[] = []
        for (const [name, buf] of entries) {
          if (name.startsWith('audio/') && (name.endsWith('.wav') || name.endsWith('.mid'))) {
            const isMidi = name.endsWith('.mid')
            const ext = isMidi ? '.mid' : '.wav'
            const baseName = name.replace('audio/', '')
            const metaName = name.replace(ext, '.meta.json')
            const metaBuf = entries.get(metaName)
            const meta = metaBuf ? JSON.parse(metaBuf.toString('utf-8')) : {}

            const ab = new Uint8Array(buf).buffer
            audioFiles.push({ name: baseName, buffer: ab, meta })
          }
        }

        // Sort by name so source_0, source_1, etc. come in order
        audioFiles.sort((a, b) => a.name.localeCompare(b.name))

        resolve({ manifest, state, timeline, audioFiles })
      }
    })
  })
}
