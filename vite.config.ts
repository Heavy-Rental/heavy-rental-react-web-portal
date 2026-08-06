import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_API_TARGET is set per npm script via .env.mock / .env.api (Spec-project-environment.md
  // FR-011, Spec-frontend-api-integration.md FR-002) — chooses the mock server vs. a future
  // Spring Boot backend without touching src/app/api.ts's relative BASE = "/api".
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})
