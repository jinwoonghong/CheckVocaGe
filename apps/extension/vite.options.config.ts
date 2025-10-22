import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'src/options/pro-settings.html'),
      },
      output: {
        // keep original path under dist/src/options/...
        assetFileNames: (chunk) => {
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});

