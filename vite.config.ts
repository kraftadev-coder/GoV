import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Production optimizations for Nigerian 3G users
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Source maps for debugging
    sourcemap: false,
    // Smaller chunk warning threshold
    chunkSizeWarningLimit: 500,
  },
  // Dev server config
  server: {
    host: true,
    port: 5173,
    // Proxy /api/* to Wrangler dev server for local Worker integration
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
