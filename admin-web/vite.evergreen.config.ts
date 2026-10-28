import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This preview is intentionally excluded from the production /p1-admin/ build.
export default defineConfig({
  plugins: [react()],
  base: '/p1-admin/',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: {
    outDir: '../output/admin-evergreen-v3-20261028/prototype-build',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: { input: 'evergreen.html' },
  },
});
