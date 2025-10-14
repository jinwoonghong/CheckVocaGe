import { defineConfig } from 'vite';
// Use dynamic import to ensure ESM entry is used
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(async () => {
  const preact = (await import('@preact/preset-vite')).default;
  return {
    root: __dirname,
    plugins: [preact()],
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@core': resolve(__dirname, '../../packages/core/src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/quiz/index.html'),
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});

