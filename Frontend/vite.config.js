import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_BACKEND_URL || 'http://localhost:5005';
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
        },
        '/socket.io': {
          target: target,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
