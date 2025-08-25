import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,
    proxy: {
      // Proxy API calls to the local backend (running on the same dev machine)
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/clients': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/sectors': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/beds': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/items': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/orders': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/stock-movements': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/public': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
