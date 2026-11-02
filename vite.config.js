import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Percorsi relativi: l'app funziona sia in locale sia in una sottocartella (GitHub Pages).
  base: './',
  build: {
    target: ['safari15', 'es2020'],
    assetsInlineLimit: 0,
  },
  server: { host: true, port: 5180 },
  preview: { host: true, port: 5181 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // la registrazione la gestiamo noi (src/pwa.js)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Ricalco',
        short_name: 'Ricalco',
        description: 'Ricalca disegni su carta usando la fotocamera',
        lang: 'it',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        // orientamento non forzato
        background_color: '#0c0d10',
        theme_color: '#0c0d10',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
