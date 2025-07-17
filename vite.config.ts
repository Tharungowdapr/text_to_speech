import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react']
  },
  server: {
    port: 5173,
    host: true, // Expose to network
    open: true  // Open browser automatically
  },
  preview: {
    port: 5173,
    host: true
  }
});