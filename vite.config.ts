import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  const wsTarget = env.VITE_WS_PROXY_TARGET || 'ws://localhost:8080';

  return {
    base: '/',
    plugins: [react()],
    server: {
      proxy: {
        '/health': target,
        '/register': target,
        '/login': target,
        '/refresh': target,
        '/logout': target,
        '/projects': target,
        '/files': target,
        '/lsp': {
          target: wsTarget,
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
  };
})
