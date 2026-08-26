import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate' — this is a billing app; a new service
      // worker must never silently activate and reload the page out from
      // under someone mid-invoice. The app decides when to apply an update
      // (see hooks/usePwaUpdate.js + components/UpdateBanner.jsx), only
      // ever in response to an explicit user tap.
      registerType: 'prompt',
      injectRegister: null,
      workbox: {
        // No runtimeCaching entries for /api/** — deliberately. Only the
        // built static app shell (JS/CSS/HTML/icons) is precached below;
        // every data request always goes straight to the network, same as
        // with no service worker at all. That's what keeps this an
        // app-shell cache and not an offline-write system: there is no
        // cached or queued API response anywhere, ever.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Mahaveer Electrical Shop Billing',
        short_name: 'Mahaveer Billing',
        description: 'Billing system for Mahaveer Electrical Shop',
        theme_color: '#1d4ed8',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
