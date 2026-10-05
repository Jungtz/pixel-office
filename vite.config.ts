import 'dotenv/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import fs from 'fs';
import path from 'path';

function readConfigPort(): number {
  try {
    const raw = fs.readFileSync(path.resolve('config.json'), 'utf-8');
    const config = JSON.parse(raw);
    return config.port || 3000;
  } catch {
    return 3000;
  }
}

const frontendPort = readConfigPort();

/**
 * 反代子路徑（參考 news-gateway BASE_PATH）：
 * 空字串或 `/` 視為根路徑；其餘正規化為 `/xxx`，Vite base 需尾斜線（`/xxx/`）。
 */
function readBasePath(): string {
  const raw = (process.env.BASE_PATH || '').trim();
  if (!raw || raw === '/') return '/';
  const p = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/+$/, '');
  return `${p}/`;
}

const viteBase = readBasePath();
// 開發 proxy 同時接受根 `/api` 與子路徑 `/xxx/api`（後端兩者皆掛載，參照 news-gateway 作法）
const apiProxy = {
  target: 'http://localhost:3001',
  changeOrigin: true,
  secure: false,
};

// https://vitejs.dev/config/
export default defineConfig({
  base: viteBase,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: frontendPort,
    proxy: {
      '/api': apiProxy,
      ...(viteBase !== '/' ? { [`${viteBase.slice(0, -1)}/api`]: apiProxy } : {}),
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
