/**
 * check-json — pre-commit 的 JSON 语法校验（零依赖，~30 行）
 *
 * 为什么需要：tests/golden/*.json 与 src/data/rag*.json 是**构建产物 + 评测基准**，
 * 语法坏掉时 vitest 会报「No test suite found」这类与根因无关的错，很难定位。
 * 在提交入口拦住，错误信息直接指向文件。
 *
 * 用法：node scripts/check-json.mjs <file...>
 */

import { readFileSync } from 'node:fs'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('用法：node scripts/check-json.mjs <file...>')
  process.exit(1)
}

let failed = 0
for (const file of files) {
  try {
    JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    failed++
    console.error(`✗ JSON 语法错误：${file}\n  ${error.message}`)
  }
}

if (failed > 0) {
  console.error(`共 ${failed} 个文件未通过 JSON 校验`)
  process.exit(1)
}
console.log(`✓ ${files.length} 个 JSON 文件语法正确`)

