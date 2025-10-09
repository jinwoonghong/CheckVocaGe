import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  plugins: [preact()],
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/quiz/index.html'),
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});

