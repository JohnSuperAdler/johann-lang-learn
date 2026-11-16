import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    // 離線可用（N3）：程式與全部教材 JSON 都預先快取；有新版時自動更新。
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,json,png,svg,mp3}'], cleanupOutdatedCaches: true },
      manifest: {
        name: '韓語／葡萄牙語學習',
        short_name: '語言學習',
        description: '韓語與巴西葡萄牙語：字母、單字、文法、考試與每日複習',
        lang: 'zh-Hant',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f7f5',
        theme_color: '#1d4ed8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // 測試時用瀏覽器版 Svelte，元件才能在 jsdom 掛載。
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
