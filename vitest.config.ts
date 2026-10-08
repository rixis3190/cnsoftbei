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
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        // src/config/** 只放常量与阈值（属「生成物 + 人工固化值」），
        // 正确性由 tuneThreshold.test.ts 的一致性断言保证；
        // 放进分母只会把常量文件算成「已覆盖」，具有误导性（T5-R7）。
        'src/config/**',
      ],
      // ratchet 门槛（只升不降，单次抬升不超过 5 点）
      // 2026-10-07 基线：lines 19.75 / statements 18.99 / functions 13.94 / branches 12.72
      // 2026-10-08 实测（RAG + 漏斗 + 基准集审校后，22 文件 / 515 用例）：
      //   statements 30.59 / branches 22.70 / functions 20.25 / lines 31.15
      //   —— 注意 vitest 列序是 Stmts → Branch → Funcs → Lines，别错配。
      // 本次按「单次 ≤ +5 点」抬到 24/20/17/17，留 2~3 点缓冲；
      // 剩余空间（statements 30.59、lines 31.15）留给下一次抬升，不一次性抬到位。
      thresholds: {
        lines: 24,
        statements: 20,
        functions: 17,
        branches: 17,
      },
    },
  },
})
