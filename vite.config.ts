import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      // 这里的 includeAssets 只是为了让 vite 知道这些文件，即使本地没有也不报错
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'], 
      manifest: {
        name: '满分上岸',
        short_name: '满分上岸',
        description: 'Ace Your Exam - 离线刷题助手',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/', // 修复 PWABuilder 报错：Start URL must be set
        scope: '/',
        // 核心修改：直接使用稳定的在线图床图标
        // 这里使用的是 iconify 的在线 API 生成的图标，绝对稳定
        icons: [
          {
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=192&height=192&format=png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'  // 关键：有些设备需要 any
          },
          {
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=192&height=192&format=png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable' // 关键：安卓需要 maskable 图标
          },
          {
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=512&height=512&format=png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=512&height=512&format=png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // 确保在线图标能被缓存，离线也能显示
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.iconify\.design\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'online-icon-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 缓存一年
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})