import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-proxy/ollama': {
        target: 'https://ollama.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-proxy\/ollama/, ''),
      },
      '/api-proxy/opencode': {
        target: 'https://opencode.ai',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-proxy\/opencode/, ''),
      },
      '/api-proxy/agnes': {
        target: 'https://apihub.agnes-ai.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-proxy\/agnes/, ''),
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
});
