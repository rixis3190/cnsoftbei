import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // 真实接口用例会消耗 API 额度，需显式执行：npm run test:api
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integration/**'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
      // ratchet 门槛（只升不降）
      // 基线来源：2026-10-07 全绿基线实测值 lines 19.75 / statements 18.99 / functions 13.94 / branches 12.72
      // 说明：当前 include 覆盖全部页面与组件，分母很大、覆盖率天然偏低。
      // 每次只抬升约 5 点，达标后再逐步向 70% 靠拢；禁止一步到位设 70（第一天必然红）。
      thresholds: {
        lines: 19,
        statements: 18,
        functions: 13,
        branches: 12,
      },
    },
  },
})
