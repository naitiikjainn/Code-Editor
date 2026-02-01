import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Monaco editor and its workers
          if (id.includes('monaco-editor')) {
            return 'vendor-editor';
          }
          // Collaboration libraries
          if (id.includes('yjs') || id.includes('y-websocket') || id.includes('y-monaco') || id.includes('socket.io-client')) {
            return 'vendor-collab';
          }
          // UI libraries
          if (id.includes('lucide-react') || id.includes('katex') || id.includes('react-markdown') || id.includes('dompurify')) {
            return 'vendor-ui';
          }
          // React Query and virtual (together to avoid circular deps)
          if (id.includes('@tanstack')) {
            return 'vendor-tanstack';
          }
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
    // Increase chunk size warning limit (Monaco is large)
    chunkSizeWarningLimit: 1000,
    // Use esbuild for minification (faster, built-in)
    minify: 'esbuild',
    // Generate source maps for production debugging
    sourcemap: false,
  },
  // Drop console/debugger in production
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      'lucide-react',
    ],
  },
})
