import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  // For CI tests we don't need Vite/Preact plugin
  plugins: [],
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src')
    }
  },
  test: {
    environment: 'jsdom'
  }
});
