import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite config for building React "islands" — standalone bundles
 * that mount into existing vanilla HTML/JS pages.
 *
 * Outputs a single IIFE script (`islands.js`) plus its CSS to /islands-dist/.
 * The existing HTML pages load these via <script> and <link> tags.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@checks-happy/shared': path.resolve(__dirname, '../packages/shared/src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: '../islands-dist',
    emptyDirBeforeWrite: true,
    // Build as a single self-executing bundle
    lib: {
      entry: path.resolve(__dirname, 'src/islands/index.tsx'),
      name: 'PrepHappyIslands',
      fileName: () => 'islands.js',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle everything — React, ReactDOM included (no external CDN needed)
      external: [],
      output: {
        // Single CSS file for all island styles
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'islands.css';
          }
          return assetInfo.name || 'asset-[hash]';
        },
      },
    },
    // Keep bundle reasonably small
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
    },
  },
})
