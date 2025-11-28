import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '满分上岸',
        short_name: '满分上岸',
        description: 'Ace Your Exam - 离线刷题助手',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        // --- 关键修复开始 ---
        start_url: '/', // 修复 "Start URL must be set" 报错
        scope: '/',
        icons: [
          {
            // 使用在线图标链接，解决 "Add a 192x192 PNG icon" 报错
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=192&height=192',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable', // 修复 "purpose set to any" 报错
          },
          {
            src: 'https://api.iconify.design/lucide:book-open-check.svg?color=%236366f1&width=512&height=512',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        // --- 关键修复结束 ---
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            // 缓存这些在线图标，保证离线也能显示
            urlPattern: /^https:\/\/api\.iconify\.design\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'icon-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
