/**
 * gen-golden-review-sheet — 生成「基准集人工抽检清单」（构建期脚本，零网络）
 *
 * 背景（计划 §9.5 R4 的遗留项 / HANDOVER §13 B-24）：
 * 基准集 113 条目前是 **AI 辅助系统化审校**（`meta.reviewedBy='ai-assisted-systematic-review'`），
 * 计划要求的「人工抽检」尚未做。人工逐条读 113 条成本高，
 * 这里把每条压缩成一行 + **自动打风险标记**，让抽检者只花时间在可疑条目上。
 *
 * 风险标记（都是启发式，只用于「优先看哪几条」，不构成结论）：
 *   [A] 禁止项与题面/参考答案**零词面重合** → 可能是不相关名词堆砌（S1-R4 明确点名的问题）
 *   [B] fair 锚点长度 > excellent 的 55% → 分档过近，可能不足以代表「中等回答」
 *   [C] poor 锚点包含参考答案前 10 字 → 负样本太接近答案，区分度存疑
 *   [D] 要点以 20 字截断且结尾不是标点 → 可能仍是残句
 *   [E] 参考答案 ≤3 字（单 token 填空题）→ 规则层区分度弱，靠语义层承担
 *
 * 用法：npx tsx scripts/gen-golden-review-sheet.ts
 * 产物：test-results/golden-review-sheet.md（test-results/ 已在 .gitignore）
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import goldenSet from '../tests/golden/goldenSet.json'
import { scorablePoints, tokenize } from '../src/services/textMatch'

interface Item {
  id: string
  question: string
  referenceAnswer: string
  referenceSource: string
  expectedPoints: string[]
  mustExclude: string[]
  anchors: { excellent: string; fair: string; poor: string }
  tags: string[]
  bank: string
  type: string
  reviewed: boolean
}

const items = (goldenSet as { items: Item[] }).items
const meta = (goldenSet as unknown as { meta: Record<string, unknown> }).meta

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** 零词面重合 = 禁止项里的任何词都没在题面/答案里出现过 */
function excludeIsUnrelated(item: Item): boolean {
  const pool = new Set(tokenize(`${item.question} ${item.referenceAnswer}`))
  return item.mustExclude.some(ex => {
    const tokens = tokenize(ex)
    return tokens.length > 0 && !tokens.some(t => pool.has(t))
  })
}

function flagsOf(item: Item): string[] {
  const flags: string[] = []
  if (excludeIsUnrelated(item)) flags.push('A')
  if (item.anchors.fair.length > item.anchors.excellent.length * 0.55) flags.push('B')
  const head = item.referenceAnswer.slice(0, 10)
  if (head.length >= 6 && item.anchors.poor.includes(head)) flags.push('C')
  // 只标记「看起来被截断」的要点：以悬空连接词/助词结尾、括号不配对、或像代码示例。
  // 早先的判据是「长度 ≥20 且不以句末标点结尾」，把完整子句也误报成残句（抽检清单第一版的 4 条误报）。
  if (
    item.expectedPoints.some(
      p =>
        /[的到为和与或在把被是不会需由成吗呢吧了]$/.test(p.trim()) ||
        (p.match(/[（(]/g)?.length ?? 0) !== (p.match(/[）)]/g)?.length ?? 0) ||
        /^(示例|例如|比如|举例)\s*[:：]/.test(p.trim()) ||
        // 以分隔符结尾的截断枚举（如 golden-python-q90 的「r读/w写/a追加/」，D 曾漏检）——
        // 纯标号要点（`//`、`>>`）豁免，判据与 gen-golden-dataset 的同名过滤保持一致
        (/[/、，,;；]$/.test(p.trim()) && p.trim().length > 4 && /[\u4e00-\u9fa5]/.test(p)),
    )
  ) {
    flags.push('D')
  }
  if (item.referenceAnswer.length <= 3) flags.push('E')
  return flags
}

const rows = items.map(item => ({ item, flags: flagsOf(item) }))
const bad = rows.filter(r => r.flags.length > 0)
const markerCounts = new Map<string, number>()
for (const r of rows) for (const f of r.flags) markerCounts.set(f, (markerCounts.get(f) ?? 0) + 1)

const lines: string[] = []
lines.push('# 基准集人工抽检清单（自动生成，勿手改）')
lines.push('')
lines.push(`生成命令：\`npx tsx scripts/gen-golden-review-sheet.ts\` 条目：${items.length}`)
lines.push('')
lines.push(`- 审校方式：\`${String(meta.reviewedBy ?? '未知')}\` 锚点来源：\`${String(meta.anchorSource ?? '未知')}\``)
lines.push(`- 带风险标记的条目：**${bad.length} / ${items.length}**（标记含义见脚本头注释）`)
lines.push(
  `- 标记分布：${[...markerCounts.entries()].map(([k, v]) => `${k}=${v}`).join('、') || '（无）'}`,
)
lines.push('')
lines.push('## 抽检方法（建议 15 分钟）')
lines.push('')
lines.push('1. 先看**带 `A` 且不带 `E`** 的条目（A 对单 token / 填空型题是**结构性成立**的：参考答案只有一个词时，' +
        '任何标签级误区都必然与它零词面重合，不代表数据有问题）。若确认某条禁止项是「无关名词堆砌」，' +
        '**要改的是 `scripts/gen-golden-dataset.ts` 里的 `MISCONCEPTIONS` 误区表**（`tests/golden/goldenSet.json` 是生成物，' +
        '直接改会被 `npm run golden:build` 覆盖），改完重跑生成器；')
lines.push('2. 再抽样 20 条（含 `E` 单 token 题）：确认「预期要点」确实是本题的知识点，且「禁止项」是常见误区而不是正确答案；')
lines.push('3. 抽查 `poor` 锚点：它应当读起来像「答了一点又说不清」，不能包含参考答案的完整句子；')
lines.push('4. 全部通过后，把 `src/config/qualityThresholds.ts` 的 `humanReviewed` 置 `true`、重跑 `npm run threshold:tune`，')
lines.push('   并在 `HANDOVER.md` §12.2 追加一行（含命令与结果）。**在此之前任何评测数字不得对外引用。**')
lines.push('')
lines.push('## 风险标记条目（先看这些）')
lines.push('')
lines.push('| # | id | 标记 | 题库 | 题面（截断） | 参考答案（截断） | 禁止项 |')
lines.push('|---|---|---|---|---|---|---|')
bad.forEach((r, i) => {
  lines.push(
    `| ${i + 1} | ${r.item.id} | ${r.flags.join('')} | ${r.item.bank} | ${cut(r.item.question, 34)} | ` +
      `${cut(r.item.referenceAnswer, 34)} | ${r.item.mustExclude.join(' / ')} |`,
  )
})
lines.push('')
lines.push('## 全部条目（按风险标记优先排序）')
lines.push('')
lines.push('| # | id | 标记 | 要点数 | 真要点数 | 禁止项数 | 锚点长度 e/f/p | 参考答案（截断） |')
lines.push('|---|---|---|---|---|---|---|---|')
const sorted = [...rows].sort((a, b) => b.flags.length - a.flags.length)
sorted.forEach((r, i) => {
  const a = r.item.anchors
  lines.push(
    `| ${i + 1} | ${r.item.id} | ${r.flags.join('') || '—'} | ${r.item.expectedPoints.length} | ` +
      `${scorablePoints(r.item.expectedPoints).length} | ${r.item.mustExclude.length} | ` +
      `${a.excellent.length}/${a.fair.length}/${a.poor.length} | ${cut(r.item.referenceAnswer, 40)} |`,
  )
})

const outDir = path.resolve(process.cwd(), 'test-results')
mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'golden-review-sheet.md')
writeFileSync(out, `${lines.join('\n')}\n`, 'utf8')
console.log(`✅ 抽检清单已生成：${out}`)
console.log(`   条目 ${items.length}，带风险标记 ${bad.length}；标记分布 ${[...markerCounts.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`)
