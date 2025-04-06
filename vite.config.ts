import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'], // Force l'inclusion de lucide-react
  },
  build: {
    target: 'esnext',
  },
});