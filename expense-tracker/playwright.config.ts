import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 4173
/** The API the app under test talks to; fixtures reset its data before each test. */
export const API_PORT = 4175

export default defineConfig({
  testDir: 'e2e',
  // Every test shares one API server and resets its data, so tests must not run at the same time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run server',
      env: { PORT: String(API_PORT), DATA_DIR: join(tmpdir(), 'expense-tracker-e2e'), API_RESET: '1' },
      url: `http://localhost:${API_PORT}/api/data`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
