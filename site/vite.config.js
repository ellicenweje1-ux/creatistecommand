import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_BASE lets the preview build (published as a static artifact) use relative
// asset paths; production on the domain uses the default "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
