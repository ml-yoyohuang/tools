import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the static build works from any sub-folder (e.g. /tools/motion-atlas/dist/).
// The production build is written to ./dist and committed, so the repo's static hosting can serve it.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
