import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/GradeCompanion/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'GradeCompanion',
        short_name: 'GradeCompanion',
        description: 'A companion app for teaching and grading.',
        theme_color: '#ea580c',
        background_color: '#faf7f3',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/GradeCompanion/',
        start_url: '/GradeCompanion/',
        icons: [
          {
            src: 'grade64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'grade192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'grade512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'grade512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});