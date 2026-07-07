import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web 版本：开发时由 Vite 提供前端，并通过 proxy 将 /api 转发到 Express 后端 (3000)
// 生产/Electron 版本：Express 直接托管 dist/ 静态资源，/api 同源，无需代理
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
