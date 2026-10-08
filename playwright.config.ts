import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // 30s 对 dev server 的首次模块转换不够用：2026-10-08 实测出现 `page.goto` 超时
  // （vite 要现场转换 antd/recharts 等依赖，CI 的 runner 更慢）。
  // 这里放宽到 60s，并单独给导航 45s；**不加重试** —— 重试会掩盖真实的不稳定。
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    navigationTimeout: 45000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
