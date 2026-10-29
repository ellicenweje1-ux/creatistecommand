import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_BASE lets the preview build (published as a static artifact) use relative
// asset paths; production on the domain uses the default "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  // Stamped into every document link (?v=…) so a re-exported PDF with the same name is never served from a cache.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
})
