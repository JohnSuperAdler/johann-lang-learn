import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  // 測試時用瀏覽器版 Svelte，元件才能在 jsdom 掛載。
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
