import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
