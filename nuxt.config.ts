import { fileURLToPath } from 'node:url'
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  devtools: { enabled: false },
  ssr: false,
  css: ['./app/assets/css/main.css'],
  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      strictPort: true,
    },
    plugins: [
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Always resolve the package root to the Cubism 4-only bundle,
        // bypassing the exports map to avoid loading the Cubism 2 runtime.
        '@sekai-world/pixi-live2d-display-mulmotion': fileURLToPath(new URL('./node_modules/@sekai-world/pixi-live2d-display-mulmotion/dist/cubism4.es.js', import.meta.url)),
      },
    },
    optimizeDeps: {
      include: [
        '@tauri-apps/api/dpi',
        '@tauri-apps/api/event',
        '@tauri-apps/api/webviewWindow',
        '@tauri-apps/api/window',
        '@tauri-apps/plugin-http',
        '@tauri-apps/plugin-shell',
        '@tauri-apps/plugin-sql',
        '@tauri-apps/plugin-store',
        '@sekai-world/pixi-live2d-display-mulmotion',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'pixi.js',
      ],
    },
  },
  app: { head: { title: '雪ノAI' } },
  nitro: { preset: 'static' },
});
