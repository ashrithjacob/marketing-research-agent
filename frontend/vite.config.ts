import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` talks to a locally running backend — `npm run dev` in
    // `server/`, which listens on MRA_PORT (8000 by default). See the
    // "Without Docker" section of README.md.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
