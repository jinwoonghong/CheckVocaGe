import { defineConfig } from 'vite';
// preact preset will be dynamically imported below
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(async () => {
  const preact = (await import('@preact/preset-vite')).default;
  return {
    plugins: [preact()],
    resolve: {
      alias: {
        '@core': resolve(__dirname, '../../packages/core/src'),
      },
    },
    server: {
      port: 5173,
    },
  };
});
