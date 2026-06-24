import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // ook bereikbaar op je telefoon in hetzelfde wifi-netwerk
    port: 5173,
    strictPort: true, // altijd 5173 → matcht de toegestane origin in je Google-client
    proxy: {
      // Dev-proxy naar de publieke FOSSGIS Valhalla → voorkomt CORS in de browser.
      '/valhalla': {
        // Standaard de publieke FOSSGIS-instance. Wijs naar je eigen self-hosted
        // Valhalla met: VALHALLA_PROXY_TARGET=http://localhost:8002 npm run dev
        target: process.env.VALHALLA_PROXY_TARGET || 'https://valhalla1.openstreetmap.de',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/valhalla/, ''),
      },
    },
  },
})
