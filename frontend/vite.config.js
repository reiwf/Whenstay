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
      headers: {
        'Content-Security-Policy': "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; object-src 'none'; frame-src 'self' https://js.stripe.com https://hooks.stripe.com;"
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
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
      assetsInlineLimit: 0, // Prevent inlining of flag assets
    },
    optimizeDeps: {
      include: [
        'react-phone-number-input/flags',
        '@stripe/stripe-js',
        '@stripe/react-stripe-js'
      ],
    },
    define: {
      // Ensure proper module resolution for Stripe
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    },
  }
})
