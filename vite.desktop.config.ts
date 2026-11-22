import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'pos-desktop'),
  plugins: [react()],
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.mjs'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'src-tauri/dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
