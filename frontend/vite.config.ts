import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // dev mein /api seedha FastAPI pe bhej do
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
