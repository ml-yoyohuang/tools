import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// base: './' so the committed build works from /tools/sooc-lab/dist/ on GitHub Pages.
export default defineConfig({
  base: './',
  server: { port: 5178, host: true },
  build: {
    rollupOptions: {
      input: { main: r('./index.html'), test: r('./test.html') },
    },
  },
});
