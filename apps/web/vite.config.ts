// Avoid cross-module type identity issues with multiple vite installs
import type { UserConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: UserConfig = {
  plugins: preact() as any,
    resolve: {
      alias: {
        '@core': resolve(__dirname, '../../packages/core/src'),
      },
    },
    server: {
      port: 5173,
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('preact')) return 'vendor-preact';
              return 'vendor';
            }
            if (id.includes('/packages/core/')) return 'core';
          },
        },
      },
    },
};

export default config;
