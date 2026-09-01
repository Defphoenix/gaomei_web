import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY || 'http://127.0.0.1:18081'
// Local Django with Range-capable /media (src code on :18082). Prod Apache also works.
const mediaTarget = process.env.VITE_MEDIA_PROXY || 'http://127.0.0.1:18082'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 18080,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/wes': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/media': {
        target: mediaTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
