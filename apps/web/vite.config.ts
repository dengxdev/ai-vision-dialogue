import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['sharp'],
  },
  resolve: {
    alias: {
      // 直接引用 workspace 源码，避免浏览器加载 CommonJS 构建产物导致 exports 未定义
      '@ai-vision/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@ai-vision/config': path.resolve(__dirname, '../../packages/config/src/index.ts'),
      '@ai-vision/contract': path.resolve(__dirname, '../../packages/contract/src/index.ts'),
      '@ai-vision/audio-utils': path.resolve(__dirname, '../../packages/audio-utils/src/index.ts'),
      '@ai-vision/token-compressor': path.resolve(__dirname, '../../packages/token-compressor/src/index.ts'),
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: ['sharp'],
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
});
