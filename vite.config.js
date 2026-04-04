import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
  }
})
