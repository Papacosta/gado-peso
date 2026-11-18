import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "PesoVivo — Pesagem de bovinos por imagem",
        short_name: "PesoVivo",
        lang: "pt-BR",
        description: "Estimativa do peso vivo de bovinos por foto, com o celular em ponto fixo.",
        theme_color: "#2e7d32",
        background_color: "#f1f8e9",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // A tela de login e a API nunca saem do cache: precisam do servidor.
        globIgnores: ["**/login.html"],
        navigateFallbackDenylist: [/^\/login\.html/, /^\/api\//, /^\/photos\//],
        runtimeCaching: [
          {
            urlPattern: /^https?.*\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https?.*\/photos\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "photos-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    minify: "esbuild",
  },
});