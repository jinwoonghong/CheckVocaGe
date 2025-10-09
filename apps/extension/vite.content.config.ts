import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sanitizeUnicodePlugin = {
  name: 'sanitize-unicode',
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && typeof chunk.code === 'string') {
        chunk.code = chunk.code.replace(/\uFFFF/g, '\\uFFFF');
      }
    }
  },
};

export default defineConfig({
  root: __dirname,
  plugins: [preact(), sanitizeUnicodePlugin],
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.ts'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'content.js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
