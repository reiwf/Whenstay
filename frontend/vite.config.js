import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
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
      sourcemap: !isProd,
      target: 'es2018', 
      cssCodeSplit: true,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // predictable vendor/app chunks for better caching
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  }
})
