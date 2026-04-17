import { defineConfig, ConfigEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }: ConfigEnv) => {
  const isProd = command === 'build';

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: true,
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-is',
        'react-router-dom',
        '@tanstack/react-query',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
    },

    // Drop console.* and debugger statements only in production builds
    ...(isProd ? { esbuild: { drop: ['console', 'debugger'] as ('console' | 'debugger')[] } } : {}),

    build: {
      chunkSizeWarningLimit: 1500,
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
            'vendor-query':    ['@tanstack/react-query'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-charts':   ['recharts'],
            'vendor-pdf':      ['jspdf', 'jspdf-autotable', 'html2canvas'],
            'vendor-icons':    ['lucide-react'],
          },
        },
      },
    },
  };
});
