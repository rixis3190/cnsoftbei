/**
 * 阈值标定与固化阈值的一致性测试（S3-7 / S3-8 / S3-9）
 *
 * 断言计划 DoD 的核心不变量：
 *   「poor 锚点得分中位数 < 已固化阈值 ≤ excellent 锚点得分中位数」
 * 以及报告结构完整（全阈值表 + Youden J 最优点 + LOO 稳定性 + usable 标记）。
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
    expect(report.meta.humanReviewed).toBe(false)
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

  it('usable 标记存在且为 false（锚点未人工审校 → 保持影子模式）', () => {
    expect(report.result.usable).toBe(false)
    expect(report.result.usableReason).toContain('影子模式')
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

  it('正负样本中位数不重叠', () => {
    expect(report.result.mediansOverlap).toBe(false)
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
