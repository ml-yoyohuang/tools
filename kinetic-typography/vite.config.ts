import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the built site works from any sub-folder (e.g. /kinetic-typography/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
