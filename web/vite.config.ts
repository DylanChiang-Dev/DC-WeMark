import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
