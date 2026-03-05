import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      {
        name: 'copy-probe-py',
        closeBundle() {
          const src = resolve(__dirname, 'src/main/demucs/probe.py')
          const destDir = resolve(__dirname, 'out/main/demucs')
          mkdirSync(destDir, { recursive: true })
          copyFileSync(src, resolve(destDir, 'probe.py'))
        }
      }
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    publicDir: resolve(__dirname, 'src/renderer/public'),
    optimizeDeps: {
      exclude: ['js-synthesizer']
    }
  }
})
