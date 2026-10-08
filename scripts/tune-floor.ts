/**
 * tune-floor — RETRIEVAL_FLOOR 标定与校验（构建期脚本，零网络）
 *
 * 背景（计划 §1.3 / S4-R4 / HANDOVER §13 B-28）：
 * `RETRIEVAL_FLOOR` 决定「低于多少分视为知识库无覆盖 → 按 L3 不注入上下文」。
 * 它固化在 `src/config/qualityThresholds.ts`，必须有可复现的标定依据，
 * 否则无从判断「0.12 到底挡不挡得住无关提问」。
 *
 * 口径（与 tests/eval/rag-eval.test.ts 的 retrievalFor 一致，勿改）：
 *   - stem / overview：金标 = query.goldChunkIds
 *   - paraphrase：金标 = **该标签下的全部块**（口语化提问对应「该标签的任一块」）
 *
 * 用法：
 *   npx tsx scripts/tune-floor.ts            # 打印分布与候选代价表，给出建议值
 *   npx tsx scripts/tune-floor.ts --check    # 只校验已固化值：必须挡掉全部探针、且不误杀过多查询集条目
 *
 * 退出码：--check 模式下不满足即 exit 1（与 threshold:tune --check 的「只告警」语义不同：
 * 这里检查的是**已固化值的行为**，属确定性检查，可以失败）。
 */

import queries from '../tests/golden/rag-queries.json'
import { getIndex, retrieve } from '../src/rag/buildIndex'
import { RETRIEVAL_FLOOR } from '../src/config/qualityThresholds'

interface QueryItem {
  id: string
  query: string
  goldChunkIds: string[]
  goldTag?: string
  kind: string
}

/**
 * 明确与题库无关的探针提问（生产里用户真的会这么问）。
 * 注意：这是**人工构造的 8 条**，样本小是已知局限，结论里必须写明；
 * 想加强证据就往这个列表里加真实「跑到题库外的提问」。
 */
const IRRELEVANT_PROBES = [
  '今天天气不错适合出门散步吗',
  '晚饭吃什么好呢推荐一下',
  '明天股市走势如何',
  '帮我写一首关于春天的诗',
  '周末去哪里玩比较好',
  'zzz qqq www',
  '12345678',
  '?????',
]

/** `--check` 允许的最大「查询集内被判无覆盖」比例（超过说明 floor 误杀太多） */
const MAX_NO_HIT_RATIO = 0.1

function goldOf(q: QueryItem): string[] {
  if (q.kind !== 'paraphrase') return q.goldChunkIds
  const hint = q.goldTag ? [q.goldTag] : []
  return (getIndex()?.chunks ?? [])
    .filter(c => hint.some(t => c.tags.includes(t)))
    .map(c => c.id)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}

const fmt = (n: number) => n.toFixed(4)

function main(): void {
  const checkMode = process.argv.includes('--check')
  const all = (queries as { queries: QueryItem[] }).queries
  const index = getIndex()

  if (!index) {
    console.log('❌ 索引不可用（ragVectors/ragChunks 缺失或不一致），请先运行 npm run vectors:build')
    process.exitCode = 1
    return
  }

  // --- 查询集内：每条查询的「最佳金标块得分」---
  const byKind = new Map<string, number[]>()
  for (const q of all) {
    const gold = new Set(goldOf(q))
    const hits = retrieve(q.query, { topK: 20, floor: 0 })
    const best = Math.max(0, ...hits.filter(h => gold.has(h.chunk.id)).map(h => h.score))
    byKind.set(q.kind, [...(byKind.get(q.kind) ?? []), best])
  }

  // --- 探针：无关提问的 top1 分 ---
  const probeScores = IRRELEVANT_PROBES.map(q => retrieve(q, { topK: 3, floor: 0 })[0]?.score ?? 0)
  const maxProbe = Math.max(...probeScores)

  // --- 已固化 floor 的实际行为 ---
  const noHit = all.filter(q => retrieve(q.query, { topK: 3, floor: RETRIEVAL_FLOOR }).length === 0)
  const probesBlocked = IRRELEVANT_PROBES.filter(
    q => retrieve(q, { topK: 3, floor: RETRIEVAL_FLOOR }).length === 0,
  ).length

  console.log(`RETRIEVAL_FLOOR（已固化） = ${RETRIEVAL_FLOOR}`)
  console.log('\n各类查询的「最佳金标块得分」（topK=20, floor=0）：')
  for (const [kind, arr] of byKind) {
    const nz = arr.filter(v => v > 0).sort((a, b) => a - b)
    console.log(
      `  ${kind.padEnd(11)} 可召回 ${nz.length}/${arr.length}  min=${fmt(nz[0] ?? 0)} ` +
        `p10=${fmt(percentile(nz, 10))} 中位=${fmt(percentile(nz, 50))}`,
    )
  }
  console.log(`\n无关探针最高分 = ${fmt(maxProbe)}（共 ${IRRELEVANT_PROBES.length} 条，人工构造）`)
  console.log(`已固化 floor 的实际行为：探针挡掉 ${probesBlocked}/${IRRELEVANT_PROBES.length}；` +
    `查询集内判为无覆盖 ${noHit.length}/${all.length}（${((noHit.length / all.length) * 100).toFixed(1)}%）`)
  if (noHit.length > 0 && noHit.length <= 8) console.log(`  无覆盖条目：${noHit.map(q => q.id).join(', ')}`)

  if (checkMode) {
    const ratio = noHit.length / all.length
    const problems: string[] = []
    if (probesBlocked !== IRRELEVANT_PROBES.length) {
      problems.push(`无关探针未被全部挡掉（${probesBlocked}/${IRRELEVANT_PROBES.length}）→ floor 偏低`)
    }
    if (ratio > MAX_NO_HIT_RATIO) {
      problems.push(
        `查询集内无覆盖比例 ${(ratio * 100).toFixed(1)}% 超过上限 ${(MAX_NO_HIT_RATIO * 100).toFixed(0)}% → floor 偏高，误杀过多`,
      )
    }
    if (problems.length > 0) {
      console.log('\n❌ 校验失败：')
      for (const p of problems) console.log(`  - ${p}`)
      process.exitCode = 1
      return
    }
    console.log('\n✅ 校验通过：探针全挡、查询集误杀在容忍范围内')
    return
  }

  // --- 非 check 模式：给出候选代价表与建议值 ---
  console.log('\n候选 floor 的代价（查询集无覆盖 / 探针挡掉）：')
  for (const f of [0.12, 0.2, 0.24, 0.25, 0.26, 0.28, 0.3, 0.35]) {
    const n = all.filter(q => retrieve(q.query, { topK: 3, floor: f }).length === 0).length
    const b = IRRELEVANT_PROBES.filter(q => retrieve(q, { topK: 3, floor: f }).length === 0).length
    const mark = f === RETRIEVAL_FLOOR ? '  ← 当前固化值' : ''
    console.log(`  ${f}: 无覆盖 ${String(n).padStart(3)}/${all.length}，探针挡掉 ${b}/${IRRELEVANT_PROBES.length}${mark}`)
  }
  const recommend = Math.min(
    ...[0.15, 0.2, 0.22, 0.24, 0.25, 0.26, 0.28, 0.3].filter(
      f => IRRELEVANT_PROBES.every(q => retrieve(q, { topK: 3, floor: f }).length === 0),
    ),
  )
  console.log(
    `\n建议：取能挡掉全部探针的最小候选（保守优先，计划 S4-R4：宁可不注入也不注入不相关）= ${recommend}`,
  )
  console.log('改值后需同步：src/config/qualityThresholds.ts、docs/eval-methodology.md §4、HANDOVER §13 B-28。')
}

main()
