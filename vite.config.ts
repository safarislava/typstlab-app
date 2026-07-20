import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:8080',
      '/register': 'http://localhost:8080',
      '/login': 'http://localhost:8080',
      '/refresh': 'http://localhost:8080',
      '/logout': 'http://localhost:8080',
      '/projects': 'http://localhost:8080',
      '/files': 'http://localhost:8080',
      '/lsp': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // CodeMirror bundle
            if (id.includes('@codemirror') || id.includes('codemirror') || id.includes('@uiw')) {
              return 'codemirror';
            }
            // Icons bundle
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // React and Redux core libraries
            if (id.includes('react') || id.includes('redux')) {
              return 'vendor-react';
            }
            // General dependencies fallback
            return 'vendor';
          }
        }
      }
    }
  }
})
