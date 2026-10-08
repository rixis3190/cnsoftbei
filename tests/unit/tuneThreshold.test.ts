/**
 * 阈值标定与固化阈值的一致性测试（S3-7 / S3-8 / S3-9）
 *
 * 断言计划 DoD 的核心不变量：
 *   「poor 锚点得分中位数 < 已固化阈值 ≤ excellent 锚点得分中位数」
 * 以及报告结构完整（全阈值表 + Youden J 最优点 + LOO 稳定性 + usable 标记）。
 *
 * 2026-10-08（计划 §9.5 R4/R5）后：基准集 anchorSource='curated'（AI 辅助审校），但 humanReviewed 仍为 false（人工抽检未完成），
 * 因此这里的断言是「usable 必须与 provenance 一致，且当前为 false」，
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

  it('usable 与 provenance 一致；人工抽检未完成时必须为 false（评审 MAJOR-1 闸门）', () => {
    expect(report.result.usable).toBe(THRESHOLD_PROVENANCE.humanReviewed)
    // 基准集只经 AI 辅助审校（meta.reviewedBy），人工抽检未做（HANDOVER §13 B-24），
    // 因此 humanReviewed 必须保持 false、报告必须给出 usable=false —— 这是「未验收不写简历」的项目红线。
    expect(THRESHOLD_PROVENANCE.humanReviewed).toBe(false)
    expect(report.result.usable).toBe(false)
    expect(report.result.usableReason).toContain('人工抽检未完成')
    expect(report.result.usableReason).toContain('影子模式')
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

  it('已固化阈值落在「平台区」内（比 ±2 的硬容差更贴合标定语义）', () => {
    // 评审 MINOR-3：optimalThreshold 是 J ≥ maxJ−0.02 的平台区**中心**，
    // 中心位置随「第二强负样本」移动，一次合法的数据编辑就能把它推远 >2，
    // 而 74 处 J 仍为 1.00 —— 那条 ±2 断言会给出假红并误导读者以为阈值有问题。
    // 因此改为断言「74 落在平台区内」，同时保留一条宽松的漂移提示。
    const { optimalThreshold, plateauWidth } = report.result
    const half = plateauWidth / 2
    expect(SEMANTIC_PASS_SCORE).toBeGreaterThanOrEqual(optimalThreshold - half - 0.5)
    expect(SEMANTIC_PASS_SCORE).toBeLessThanOrEqual(optimalThreshold + half + 0.5)
    // 次级提示：超出 ±10 说明平台区整体位移，届时应重新复核（不阻断）
    expect(Math.abs(SEMANTIC_PASS_SCORE - optimalThreshold)).toBeLessThanOrEqual(10)
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
