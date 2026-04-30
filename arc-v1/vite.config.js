import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/images/logo.svg', 'assets/images/icon.png', 'assets/images/favicon.png'],
      manifest: {
        name: 'ARC - Autonomous Reasoning Companion',
        short_name: 'ARC',
        description: 'Track flight, get alert, and take action instantly',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'assets/images/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/images/icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'assets/images/splash-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  define: {
    'process.env': {}
  }
})
