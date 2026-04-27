import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/images/logo.svg'],
      manifest: {
        name: 'ARC - Autonomous Reasoning Companion',
        short_name: 'ARC',
        description: 'Track flight, get alert, and take action instantly',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'assets/images/logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'assets/images/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'assets/images/logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
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
