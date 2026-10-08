/**
 * runGoldenEval.test — 基准集零额度跑批入口（S1-7）
 *
 * 两种跑批模式，都不消耗任何 API 额度：
 * - anchor 模式（默认）：用每条基准集自己的三档锚点当候选回答，
 *   检验评分管线是否具备区分度（excellent 应高于 fair 高于 poor）。
 * - llm 模式：走 msw 固定响应，验证「基准集 → 提示词 → 模型层 → 打分 → 报告」
 *   这条链路在离线环境下可跑通。
 *
 * 口径声明：基准集已于 2026-10-08 复核为 anchorSource='curated'（reviewed=true 113 条），
 * 但尚未经过人工抽检，因此这里产出的仍是**管线可用性证据**，不是模型质量结论。
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { getGoldSet, getSmokeSet, loadGoldenSet, type GoldenItem } from '../golden/goldenSet'
import { coverageRatio, hitsMustExclude, scorablePoints } from '../../src/services/textMatch'

export interface GoldenEvalRow {
  id: string
  bank: string
  tags: string[]
  difficulty: string
  referenceSource: string
  answer: string
  /** 要点覆盖率 0~1 */
  coverage: number
  /** 命中的禁止项 */
  excludeHits: string[]
  /** 规则层是否通过（无禁止项命中且覆盖率 ≥ 阈值） */
  rulePassed: boolean
  /** 规则层得分 0~100 */
  ruleScore: number
}

/** 规则层覆盖率门槛（步骤 3 会用 ROC 校准后替换为固化阈值） */
export const RULE_COVERAGE_THRESHOLD = 0.6

/** 规则层打分：覆盖率为主，禁止项命中为硬扣分 */
export function scoreRule(answer: string, item: GoldenItem): number {
  const coverage = coverageRatio(item.expectedPoints, answer)
  const excludeHits = hitsMustExclude(answer, item.mustExclude)
  const score = coverage * 100 - excludeHits.length * 30
  return Math.max(0, Math.min(100, score))
}

function evalOne(item: GoldenItem, answer: string): GoldenEvalRow {
  const coverage = coverageRatio(item.expectedPoints, answer)
  const excludeHits = hitsMustExclude(answer, item.mustExclude)
  return {
    id: item.id,
    bank: item.bank,
    tags: item.tags,
    difficulty: item.difficulty,
    referenceSource: item.referenceSource,
    answer,
    coverage,
    excludeHits,
    rulePassed: excludeHits.length === 0 && coverage >= RULE_COVERAGE_THRESHOLD,
    ruleScore: scoreRule(answer, item),
  }
}

/** msw 固定响应：与 tests/mocks/handlers.ts 的默认分支保持一致（零额度的「模型输出」） */
const MOCK_LLM_ANSWER = '这是一个模拟的 AI 回答，用于测试目的。'

export interface GoldenEvalSummary {
  mode: 'anchor' | 'llm'
  sampleSize: number
  passRate: number
  avgScore: number
  /** anchor 模式下的区分度：excellent 均分 − poor 均分 */
  separation: number | null
  confidence: 'low' | 'medium' | 'high'
  /** 参数量全部是「答题要求」类填充项的条目数（这些条目的覆盖率无意义） */
  fillerOnlyItems: number
  /**
   * 降级可观测性（计划 §1.3 硬性约束：「任何降级都必须能在 eval-report 中看到」）。
   * 规则层直接判定，因此不经过漏斗；这里统计的是「锚点被规则层否决」的次数，
   * 用于确认禁止项硬否决确实在工作（而不是静默失效）。
   */
  degradation: {
    /** 命中禁止项（规则层硬否决）的答案条数 */
    vetoedByMustExclude: number
    /** 覆盖率低于规则层门槛的条数 */
    belowCoverageThreshold: number
  }
  note: string
}

/** 跑批：逐条打分 + 汇总，写出 test-results/golden-eval.json */
export function runGoldenEval(
  items: readonly GoldenItem[],
  pick: (item: GoldenItem) => string,
  mode: 'anchor' | 'llm',
): { rows: GoldenEvalRow[]; summary: GoldenEvalSummary } {
  const rows = items.map(item => evalOne(item, pick(item)))
  const passed = rows.filter(r => r.rulePassed).length
  const avgScore = rows.reduce((sum, r) => sum + r.ruleScore, 0) / rows.length

  let separation: number | null = null
  if (mode === 'anchor') {
    const excellentAvg =
      rows.reduce((sum, r) => sum + scoreRule(items.find(i => i.id === r.id)!.anchors.excellent, items.find(i => i.id === r.id)!), 0) /
      rows.length
    const poorAvg =
      rows.reduce((sum, r) => sum + scoreRule(items.find(i => i.id === r.id)!.anchors.poor, items.find(i => i.id === r.id)!), 0) /
      rows.length
    separation = Number((excellentAvg - poorAvg).toFixed(2))
  }

  // 降级可观测（评审 MINOR-5）：把「覆盖率无意义的条目」数出来，
  // 报告侧据此显示标注质量的边界，而不是让读者以为 100% 覆盖等于标注很好。
  const fillerOnlyItems = items.filter(
    item => item.expectedPoints.length > 0 && scorablePoints(item.expectedPoints).length === 0,
  ).length

  // 降级可观测（§1.3 硬性约束）：禁止项否决与覆盖率不达标都要能被报告读到
  const degradation = {
    vetoedByMustExclude: rows.filter(r => r.excludeHits.length > 0).length,
    belowCoverageThreshold: rows.filter(r => r.coverage < RULE_COVERAGE_THRESHOLD).length,
  }

  const summary: GoldenEvalSummary = {
    mode,
    sampleSize: rows.length,
    passRate: Number((passed / rows.length).toFixed(4)),
    avgScore: Number(avgScore.toFixed(2)),
    separation,
    confidence: rows.length >= 100 ? 'high' : rows.length >= 50 ? 'medium' : 'low',
    fillerOnlyItems,
    degradation,
    note:
      '锚点已按 2026-10-08 复核口径重构（anchorSource=curated），本报告仍是**管线可用性**证据，' +
      '不代表模型真实质量；对外引用前需完成人工抽检（见 HANDOVER §12）。' +
      `其中 ${fillerOnlyItems} 条的要点全部为「答题要求」类填充项，其覆盖率不参与打分分母。`,
  }

  const outDir = path.resolve(process.cwd(), 'test-results')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    path.join(outDir, 'golden-eval.json'),
    `${JSON.stringify({ summary, rows }, null, 2)}\n`,
    'utf8',
  )
  return { rows, summary }
}

const dataset = loadGoldenSet()
const gold = getGoldSet(dataset.items)
const smoke = getSmokeSet(dataset.items)

describe('基准集跑批（零额度）', () => {
  it('anchor 模式：excellent 得分必须高于 poor（评分管线具备区分度）', () => {
    const { rows, summary } = runGoldenEval(gold, item => item.anchors.excellent, 'anchor')
    expect(rows.length).toBe(gold.length)
    expect(summary.separation).not.toBeNull()
    expect(summary.separation!).toBeGreaterThan(20)

    // 逐条检查：优秀锚点与差锚点的得分必须严格有序。
    //
    // 例外：**单 token 参考答案**（sampleAnswer='>>' / 'JDK' / 'JRE' 这类填空题）在规则层
    // 结构上无法区分——规则层只算「要点覆盖率 + 禁止项扣分」，不做余弦，
    // 而这类题的 expectedPoints 本身就接近答案本身，任何含该 token 的回答覆盖率都是 100%。
    // 这些条目的区分度由语义层（answerScorer 的余弦项）承担，
    // 见 tests/unit/tuneThreshold.test.ts 的「每条金标 excellent > poor」断言。
    // 这里只对「参考答案长度 ≥ 4」的条目要求严格有序，并把豁免数量固定下来防止扩大。
    // 83 条金标里有 29 条是「参考答案 ≤3 字」的填空题（'>>'、'JDK'、'JRE'…），
    // 其余 54 条要求严格有序；两个数字都固定下来，防止标注质量下滑被悄悄掩盖。
    const discriminable = gold.filter(item => item.referenceAnswer.length >= 4)
    expect(discriminable.length).toBe(54)
    const notOrdered = discriminable.filter(item => {
      const excellent = scoreRule(item.anchors.excellent, item)
      const poor = scoreRule(item.anchors.poor, item)
      return !(excellent > poor)
    })
    expect(notOrdered.map(i => i.id)).toEqual([])
  })

  it('anchor 模式：报告含样本量与置信度标注', () => {
    const { summary } = runGoldenEval(gold, item => item.anchors.excellent, 'anchor')
    expect(summary.sampleSize).toBe(83)
    expect(['low', 'medium', 'high']).toContain(summary.confidence)
    expect(summary.note).toContain('管线可用')
  })

  it('降级可观测：excellent 锚点不应被禁止项否决（否则说明标注自相矛盾）', () => {
    // 用户会踩的坑：把 mustExclude 的错误说法塞进 poor 锚点 → 负样本一条不剩地命中否决，
    // 得分恒 0，看起来「完美可分」但实际什么都没测到。这里用 excellent 侧做守卫：
    // 若优秀锚点被自己的禁止项否决，说明数据集自相矛盾（要么禁止项写错，要么锚点抄错）。
    const { summary } = runGoldenEval(gold, item => item.anchors.excellent, 'anchor')
    expect(summary.degradation.vetoedByMustExclude).toBe(0)
  })

  it('降级可观测：负样本拒绝率由「语义分低」而非「规则层否决」主导', () => {
    const { summary } = runGoldenEval(gold, item => item.anchors.poor, 'anchor')
    // poor 锚点不写错误说法原文 → 不允许靠否决取胜，否则阈值标定会失去意义
    expect(summary.degradation.vetoedByMustExclude).toBe(0)
    expect(summary.degradation.belowCoverageThreshold).toBeGreaterThan(0)
  })

  it('llm 模式：msw 固定响应下链路可跑通且不消耗额度', () => {
    const { rows, summary } = runGoldenEval(smoke, () => MOCK_LLM_ANSWER, 'llm')
    expect(rows.length).toBe(smoke.length)
    expect(summary.mode).toBe('llm')
    // 固定 mock 回答与任何基准集都不相关，通过率应显著低于 anchor 模式
    expect(summary.passRate).toBeLessThan(0.5)
  })

  it('产出 test-results/golden-eval.json', async () => {
    const { readFileSync } = await import('node:fs')
    runGoldenEval(gold, item => item.anchors.excellent, 'anchor')
    const report = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'test-results', 'golden-eval.json'), 'utf8'),
    )
    expect(report.rows.length).toBe(83)
    expect(report.summary.mode).toBe('anchor')
  })

  it('禁止项命中会被扣分（负向验证）', () => {
    const item = gold.find(i => i.mustExclude.length > 0)!
    const withExclude = scoreRule(`我的答案里写了${item.mustExclude[0]}`, item)
    const withoutExclude = scoreRule(item.referenceAnswer, item)
    expect(withExclude).toBeLessThan(withoutExclude)
  })
})
