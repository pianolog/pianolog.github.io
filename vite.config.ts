import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '피아노 연습 기록',
        short_name: '연습 기록',
        description: '하농·피쉬나·레퍼토리 연습 기록',
        lang: 'ko',
        display: 'standalone',
        orientation: 'any',
        background_color: '#151311',
        theme_color: '#151311',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ]
})
