import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['framer-motion', 'lucide-react'],
    force: true, // Force re-optimization
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'utils-vendor': ['zustand', 'socket.io-client'],
        },
        // Reduce chunk splitting for icons - bundle them together
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Improve build performance
    target: 'esnext',
    minify: 'esbuild', // Use esbuild minification (faster, built-in)
    // esbuild minification options
    esbuild: {
      drop: ['console', 'debugger'], // Drop console and debugger in production
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
    hmr: {
      overlay: true,
    },
  },
});
