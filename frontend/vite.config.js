import { defineConfig } from './$node_modules/vite/dist/node/index.js'
import react from './$node_modules/@vitejs/plugin-react/dist/index.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
