import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src')
    }
  },
  test: {
    environment: 'jsdom'
  }
});
