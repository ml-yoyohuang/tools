import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  server: { port: 5178, host: true },
  build: {
    rollupOptions: {
      input: { main: r('./index.html'), test: r('./test.html') },
    },
  },
});
