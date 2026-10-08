import { defineConfig } from 'vitest/config'

/**
 * 真实大模型接口测试专用配置
 *
 * 与默认配置的区别：
 * - 只收集 tests/integration 下的用例
 * - 不加载 tests/setup.ts（避免 msw 拦截真实请求）
 * - 使用 node 环境（仅用原生 fetch，不需 DOM）
 *
 * 用法：npm run test:api
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60000,
  },
})
