/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `npm run server` serves the API; the dev and preview servers forward /api to it (API_URL overrides the address).
  server: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:3001' } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'mcp/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
