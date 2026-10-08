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
  /** 是否落盘 golden-eval.json（默认 true）。前几次「探路」调用传 false，
   *  避免后一次覆写把报告要读的降级计数冲成 0（评审 MAJOR-2）。 */
  persist = true,
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
      '不代表模型真实质量；对外引用前需完成人工抽检（见 HANDOVER §13 B-24）。' +
      `其中 ${fillerOnlyItems} 条的要点全部为「答题要求」类填充项，其覆盖率不参与打分分母。` +
      (mode === 'anchor'
        ? '本次落盘的是**负样本轮**（候选= poor 锚点）：它才是能反映「降级/拒绝」的量，' +
          'excellent 轮的否决数与覆盖率不达标数结构性恒为 0，不适合做降级观测。'
        : ''),
  }

  if (persist) {
    const outDir = path.resolve(process.cwd(), 'test-results')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      path.join(outDir, 'golden-eval.json'),
      `${JSON.stringify({ summary, rows }, null, 2)}\n`,
      'utf8',
    )
  }
  return { rows, summary }
}

const dataset = loadGoldenSet()
const gold = getGoldSet(dataset.items)
const smoke = getSmokeSet(dataset.items)

describe('基准集跑批（零额度）', () => {
  // 说明（评审 MAJOR-2）：`runGoldenEval` 会把结果落盘到 test-results/golden-eval.json，
  // 而报告里的降级卡片读的正是这份文件。因此**只有最后一条用例允许落盘**（用负样本轮），
  // 其余探路调用一律 persist=false —— 否则后写的 excellent 轮会把
  // 「规则层否决 / 覆盖率不达标」冲成结构性 0，让 §1.3 的降级观测形同虚设。
  it('anchor 模式：excellent 得分必须高于 poor（评分管线具备区分度）', () => {
    const { rows, summary } = runGoldenEval(gold, item => item.anchors.excellent, 'anchor', false)
    expect(rows.length).toBe(gold.length)
    expect(summary.separation).not.toBeNull()
    expect(summary.separation!).toBeGreaterThan(20)

    // 逐条检查：优秀锚点与差锚点的得分必须严格有序（**全部 83 条，无豁免**）。
    //
    // 早先这里对「单 token 参考答案」（'>>' / 'JDK'）留了 29 条豁免，理由是「规则层不区分」。
    // 评审指出真正的原因是 textMatch.pointCoverage 的一个缺陷：纯标号要点在归一化后变成空串，
    // 旧实现对此**无条件返回 1**（"空要点视为已覆盖"），于是任何回答——甚至空回答——
    // 在这类题上都拿满分（实测 scoreAnswer('', 单符号题).total === 100）。
    // 该缺陷已修（空 key 改为对原文做子串判定），修完后 83 条全部严格有序，豁免不再需要。
    // 若这条断言再次失败，优先怀疑是标注或覆盖率口径出了问题，而不是去放宽豁免。
    const notOrdered = gold.filter(item => {
      const excellent = scoreRule(item.anchors.excellent, item)
      const poor = scoreRule(item.anchors.poor, item)
      return !(excellent > poor)
    })
    expect(notOrdered.map(i => i.id)).toEqual([])
  })

  it('空回答不得白拿分数（纯标号要点的覆盖率不能恒为 1）', () => {
    // 回归守卫：单符号题的 expectedPoints 归一化后是空串，历史上会被判为「已覆盖」。
    // 这里用「答案本身」和「空串」两个极端把口径钉住。
    const symbolItems = gold.filter(item => item.referenceAnswer.length <= 3)
    expect(symbolItems.length).toBeGreaterThan(0)
    for (const item of symbolItems) {
      expect(coverageRatio(item.expectedPoints, item.anchors.excellent)).toBeGreaterThan(0)
      expect(coverageRatio(item.expectedPoints, '')).toBe(0)
    }
  })

  it('空白要点不得被判为已覆盖（includes(\'\') 恒真的残留形态）', () => {
    // 与上一条同源：纯标号要点走的是「对原文做子串判定」，
    // 若要点本身是空串/纯空白，`includes('')` 会对**任何**候选返回 true —— 又变回满分。
    // 校验器会拦数据集里的空要点，但 textMatch 是公共工具，必须在函数内部自保。
    expect(coverageRatio(['   '], '任意回答')).toBe(0)
    expect(coverageRatio(['', '合格要点'], '完全无关的回答')).toBe(0)
  })

  it('anchor 模式：报告含样本量与置信度标注', () => {
    const { summary } = runGoldenEval(gold, item => item.anchors.excellent, 'anchor', false)
    expect(summary.sampleSize).toBe(83)
    expect(['low', 'medium', 'high']).toContain(summary.confidence)
    expect(summary.note).toContain('管线可用')
  })

  it('降级可观测：正样本 0 否决；负样本靠「覆盖率低」取胜而不是靠硬否决', () => {
    // 两条守卫：
    // ① excellent 若被自己的禁止项否决 → 数据集自相矛盾（禁止项写错或锚点抄错）；
    // ② poor 若是靠命中禁止项拿 0 分 → 负样本不含真实区分信息，
    //    阈值标定会退化成「验证否决规则能触发」，`negativeDiversity` 也会塌成 1。
    const excellentRun = runGoldenEval(gold, item => item.anchors.excellent, 'anchor', false)
    expect(excellentRun.summary.degradation.vetoedByMustExclude).toBe(0)
    expect(excellentRun.summary.degradation.belowCoverageThreshold).toBe(0)
    const poorRun = runGoldenEval(gold, item => item.anchors.poor, 'anchor', false)
    expect(poorRun.summary.degradation.vetoedByMustExclude).toBe(0)
    expect(poorRun.summary.degradation.belowCoverageThreshold).toBeGreaterThan(0)
  })

  it('llm 模式：msw 固定响应下链路可跑通且不消耗额度', () => {
    const { rows, summary } = runGoldenEval(smoke, () => MOCK_LLM_ANSWER, 'llm', false)
    expect(rows.length).toBe(smoke.length)
    expect(summary.mode).toBe('llm')
    // 固定 mock 回答与任何基准集都不相关，通过率应显著低于 anchor 模式
    expect(summary.passRate).toBeLessThan(0.5)
  })

  it('落盘 golden-eval.json，且降级计数取自「负样本轮」（评审 MAJOR-2）', async () => {
    // 只有这一条用例 persist=true：报告卡片读的就是这份文件。
    // 若改成 excellent 轮，两个计数会**结构性恒为 0**（否决为 0 是构造保证、
    // 覆盖率不达标为 0 是校验器保证）——等于把 §1.3 的降级观测变成空话。
    runGoldenEval(gold, item => item.anchors.poor, 'anchor')
    const { readFileSync } = await import('node:fs')
    const report = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'test-results', 'golden-eval.json'), 'utf8'),
    )
    expect(report.rows.length).toBe(83)
    expect(report.summary.mode).toBe('anchor')
    expect(report.summary.note).toContain('负样本轮')
    expect(report.summary.degradation.belowCoverageThreshold).toBeGreaterThan(0)
    expect(report.summary.degradation.vetoedByMustExclude).toBe(0)
  })

  it('禁止项命中会被扣分（负向验证）', () => {
    const item = gold.find(i => i.mustExclude.length > 0)!
    const withExclude = scoreRule(`我的答案里写了${item.mustExclude[0]}`, item)
    const withoutExclude = scoreRule(item.referenceAnswer, item)
    expect(withExclude).toBeLessThan(withoutExclude)
  })
})
