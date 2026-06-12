import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

/* Emits /sw.js with the real (hashed) asset names of this build inlined, so the
   installed app's shell is fully precached and opens offline. */
function serviceWorker() {
  return {
    name: 'cc-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hashed = Object.keys(bundle)
        .filter((f) => f !== 'index.html' && f !== 'sw.js')
        .map((f) => `/${f}`)
      const extras = [
        '/',
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/maskable-512.png',
        '/icons/apple-touch-icon.png',
      ]
      const source = readFileSync(path.join(here, 'sw.template.js'), 'utf8')
        .replace('__PRECACHE_MANIFEST__', JSON.stringify([...new Set([...extras, ...hashed])]))
        .replace('__BUILD_ID__', Date.now().toString(36))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
