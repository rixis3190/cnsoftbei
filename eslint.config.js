import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 生成物与残留目录一律不参与 lint：
  // - dist / coverage / test-results：构建与测试产物（coverage 里是报告用的 JS 文件）
  // - learning-agent：残留的历史构建目录（33k 文件），代码里零引用
  // - scripts/tmp：临时脚本收纳目录
  globalIgnores(['dist', 'coverage', 'test-results', 'learning-agent', 'scripts/tmp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // 测试文件里 mock / 构造异常响应需要 any，不按业务代码标准要求
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
