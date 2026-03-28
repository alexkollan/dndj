import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is used only for the renderer (React UI) layer.
// Electron's main process runs directly via Node — no bundling needed for main.js.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // In dev mode use '/' so HMR and absolute asset paths work correctly on the
  // Vite dev server. In production builds, use './' so that assets resolve
  // correctly when loaded from the file:// protocol inside Electron.
  base: command === 'build' ? './' : '/',
  server: {
    // Fixed port so main.js always knows where to load the renderer from in dev mode.
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
