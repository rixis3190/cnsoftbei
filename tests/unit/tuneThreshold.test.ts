/**
 * 阈值标定与固化阈值的一致性测试（S3-7 / S3-8 / S3-9）
 *
 * 断言计划 DoD 的核心不变量：
 *   「poor 锚点得分中位数 < 已固化阈值 ≤ excellent 锚点得分中位数」
 * 以及报告结构完整（全阈值表 + Youden J 最优点 + LOO 稳定性 + usable 标记）。
 *
 * 2026-10-08（计划 §9.5 R4/R5）后：基准集 anchorSource='curated' 且 humanReviewed=true，
 * 因此这里的断言从「usable 必须为 false」改为「usable 与 provenance 一致，
 * 且最优阈值必须同时满足最强负样本 < 阈值 ≤ 最弱正样本」——
 * 只断言 Youden J 会被「负样本同质」的假象骗过。
 */

import { describe, it, expect } from 'vitest'
import { tune } from '../../scripts/tune-threshold'
import { SEMANTIC_PASS_SCORE, THRESHOLD_PROVENANCE } from '../../src/config/qualityThresholds'

const report = tune()

describe('阈值标定报告结构', () => {
  it('样本量与来源已登记', () => {
    expect(report.meta.sampleSize.positive).toBe(83)
    expect(report.meta.sampleSize.negative).toBe(83)
    expect(report.meta.anchorSource).toBe(THRESHOLD_PROVENANCE.anchorSource)
    expect(report.meta.humanReviewed).toBe(THRESHOLD_PROVENANCE.humanReviewed)
  })

  it('全阈值表覆盖 0~100 且步长为 1', () => {
    expect(report.sweep.length).toBe(101)
    expect(report.sweep[0].threshold).toBe(0)
    expect(report.sweep[100].threshold).toBe(100)
  })

  it('含 Youden J 最优点与 LOO 稳定性数据', () => {
    expect(report.result.youdenJ).toBeGreaterThan(0)
    expect(report.loo.folds).toBe(83)
    expect(report.loo.accuracy).toBeGreaterThanOrEqual(0)
    expect(report.loo.stabilityRatio).toBeGreaterThanOrEqual(0)
  })

  it('usable 与 provenance 一致，且说明里带可判定结论', () => {
    expect(report.result.usable).toBe(THRESHOLD_PROVENANCE.humanReviewed)
    if (report.result.usable) {
      expect(report.result.usableReason).toContain('最强负样本')
    } else {
      expect(report.result.usableReason).toContain('影子模式')
    }
  })

  it('最优阈值必须真正分开两类（最强负样本 < 阈值 ≤ 最弱正样本）', () => {
    const { optimalThreshold, strongestNegative, weakestPositive } = report.result
    expect(strongestNegative).toBeLessThan(optimalThreshold)
    expect(weakestPositive).toBeGreaterThanOrEqual(optimalThreshold)
  })
})

describe('阈值与分数分布的一致性（DoD 核心断言）', () => {
  it('poor 锚点得分中位数 < 已固化阈值', () => {
    expect(report.result.negativeMedian).toBeLessThan(SEMANTIC_PASS_SCORE)
  })

  it('已固化阈值 ≤ excellent 锚点得分中位数', () => {
    expect(SEMANTIC_PASS_SCORE).toBeLessThanOrEqual(report.result.positiveMedian)
  })

  it('已固化阈值与标定最优值偏差在容差内（±2）', () => {
    expect(Math.abs(SEMANTIC_PASS_SCORE - report.result.optimalThreshold)).toBeLessThanOrEqual(2)
  })

  it('已固化阈值不高于最弱正样本（避免误杀合法回答）', () => {
    expect(SEMANTIC_PASS_SCORE).toBeLessThanOrEqual(report.result.weakestPositive)
  })

  it('正负样本中位数不重叠', () => {
    expect(report.result.mediansOverlap).toBe(false)
  })

  it('负样本有多样性（不是同一句模板）', () => {
    expect(report.result.negativeDiversity).toBeGreaterThanOrEqual(10)
  })
})

describe('逐条分数的确定性', () => {
  it('同一输入两次标定结果完全一致（可复现）', () => {
    const again = tune()
    expect(again.result.optimalThreshold).toBe(report.result.optimalThreshold)
    expect(again.rows.map(r => r.positive)).toEqual(report.rows.map(r => r.positive))
    expect(again.rows.map(r => r.negative)).toEqual(report.rows.map(r => r.negative))
  })

  it('每条金标的 excellent 得分高于 poor 得分', () => {
    const wrong = report.rows.filter(r => r.positive <= r.negative)
    expect(wrong.map(r => r.id)).toEqual([])
  })
})
