import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to backend during development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // Production-specific proxy configuration
  preview: {
    proxy: {
      '/api': {
        target: 'https://daftar-str8.onrender.com',
        changeOrigin: true,
      }
    }
  }
})