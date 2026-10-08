/**
 * goldenSet.test — 基准集完整性校验
 *
 * 覆盖计划 S1-6 的全部校验项，并包含**负向验证**：
 * 故意把数据集改坏，断言校验器一定会报错 ——
 * 否则「校验器一直返回 0 错误」不能证明它在工作。
 */

import { describe, it, expect } from 'vitest'
import { coverageRatio } from '../../src/services/textMatch'
import {
  assertGoldenSet,
  getGoldSet,
  getPositiveNegativePairs,
  getSmokeSet,
  loadGoldenSet,
  MAX_POINT_LENGTH,
  validateGoldenSet,
  type GoldenDataset,
} from './goldenSet'

const dataset = loadGoldenSet()

/** 拿一条真实的金标条目做变异，避免造出本身就不合法的样本 */
function firstGold(target: GoldenDataset = dataset) {
  return getGoldSet(target.items)[0]
}

describe('基准集加载', () => {
  it('数据集非空且分两层', () => {
    expect(dataset.items.length).toBeGreaterThanOrEqual(30)
    expect(getGoldSet(dataset.items).length).toBe(dataset.meta.goldCount)
    expect(getSmokeSet(dataset.items).length).toBe(dataset.meta.smokeCount)
    expect(dataset.meta.goldCount).toBe(83)
    expect(dataset.meta.smokeCount).toBe(30)
  })

  it('loadGoldenSet 返回深拷贝，修改不会污染原始数据', () => {
    const a = loadGoldenSet()
    a.items[0].question = '被测试改坏了'
    const b = loadGoldenSet()
    expect(b.items[0].question).not.toBe('被测试改坏了')
  })

  it('金标层来自真实 sampleAnswer，合成层来自客观题', () => {
    for (const item of getGoldSet(dataset.items)) {
      expect(item.referenceSource).toBe('sampleAnswer')
      expect(item.referenceAnswer.length).toBeGreaterThan(0)
    }
    for (const item of getSmokeSet(dataset.items)) {
      expect(item.referenceSource).toBe('synthesized')
      expect(item.referenceAnswer.startsWith('正确答案：')).toBe(true)
    }
  })
})

describe('基准集校验器（当前数据集应通过）', () => {
  it('无结构性错误', () => {
    const { errors } = validateGoldenSet(dataset)
    expect(errors).toEqual([])
  })

  it('assertGoldenSet 不抛错', () => {
    expect(() => assertGoldenSet(dataset)).not.toThrow()
  })

  it('id 唯一', () => {
    const ids = dataset.items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每条要点 3~5 条、长度 ≤20、互不重复', () => {
    for (const item of dataset.items) {
      expect(item.expectedPoints.length).toBeGreaterThanOrEqual(3)
      expect(item.expectedPoints.length).toBeLessThanOrEqual(5)
      expect(new Set(item.expectedPoints).size).toBe(item.expectedPoints.length)
      for (const point of item.expectedPoints) {
        expect(point.length).toBeLessThanOrEqual(MAX_POINT_LENGTH)
      }
    }
  })

  it('禁止项至少 2 条，且不与参考答案自相矛盾', () => {
    for (const item of dataset.items) {
      expect(item.mustExclude.length).toBeGreaterThanOrEqual(2)
      for (const exclude of item.mustExclude) {
        expect(item.referenceAnswer).not.toContain(exclude)
      }
    }
  })

  it('三档锚点长度单调 poor < fair < excellent', () => {
    for (const item of dataset.items) {
      const { poor, fair, excellent } = item.anchors
      expect(poor.length).toBeLessThan(fair.length)
      expect(fair.length).toBeLessThan(excellent.length)
    }
  })

  it('标签全部已归一化（形如 python-syntax）', () => {
    for (const item of dataset.items) {
      expect(item.tags.length).toBeGreaterThan(0)
      for (const tag of item.tags) {
        expect(tag).toMatch(/^[a-z]+-[a-z0-9-]+$/)
        expect(tag.startsWith(`${item.bank}-`)).toBe(true)
      }
    }
  })

  it('excellent 锚点覆盖 ≥60% 要点（防标注腐烂，与校验器同一口径）', () => {
    for (const item of dataset.items) {
      expect(coverageRatio(item.expectedPoints, item.anchors.excellent)).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('参考答案自身至少能命中一个要点（禁止项/要点不得与答案完全脱节）', () => {
    for (const item of dataset.items) {
      const best = Math.max(
        coverageRatio(item.expectedPoints, item.referenceAnswer),
        coverageRatio(item.expectedPoints, item.anchors.excellent),
      )
      expect(best).toBeGreaterThan(0)
    }
  })

  it('正负样本对只来自金标层，且 fair 不参与', () => {
    const pairs = getPositiveNegativePairs(dataset.items)
    expect(pairs.length).toBe(getGoldSet(dataset.items).length)
    for (const pair of pairs) {
      expect(pair.positive.length).toBeGreaterThan(pair.negative.length)
      expect(pair.negative).not.toBe(pair.positive)
    }
    const smokeIds = new Set(getSmokeSet(dataset.items).map(i => i.id))
    for (const pair of pairs) expect(smokeIds.has(pair.itemId)).toBe(false)
  })
})

describe('基准集校验器负向验证（改坏就必须报错）', () => {
  it('id 重复 → 报错', () => {
    const broken = loadGoldenSet()
    broken.items[1].id = broken.items[0].id
    expect(validateGoldenSet(broken).errors.some(e => e.includes('id 重复'))).toBe(true)
  })

  it('要点超过 20 字 → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).expectedPoints[0] = '这是一个刻意写得非常非常长的要点用来验证长度上限校验逻辑是否生效'
    const { errors, warnings } = validateGoldenSet(broken)
    expect([...errors, ...warnings].some(e => e.includes('要点超过'))).toBe(true)
  })

  it('要点数量不足 3 条 → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).expectedPoints = ['只有一个要点']
    const { errors, warnings } = validateGoldenSet(broken)
    expect([...errors, ...warnings].some(e => e.includes('expectedPoints 数量'))).toBe(true)
  })

  it('锚点长度不单调 → 报错', () => {
    const broken = loadGoldenSet()
    const target = firstGold(broken)
    target.anchors.poor = target.anchors.excellent
    const { errors, warnings } = validateGoldenSet(broken)
    expect([...errors, ...warnings].some(e => e.includes('锚点长度不单调'))).toBe(true)
  })

  it('sourceQuestionId 在题库中不存在 → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).sourceQuestionId = 'not-exist-999'
    expect(validateGoldenSet(broken).errors.some(e => e.includes('题库中不存在'))).toBe(true)
  })

  it('referenceAnswer 与题库 sampleAnswer 不一致 → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).referenceAnswer = '这是被改写的参考答案'
    const { errors } = validateGoldenSet(broken)
    expect(errors.some(e => e.includes('与题库 sampleAnswer 不一致'))).toBe(true)
  })

  it('金标条目误标为 synthesized → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).referenceSource = 'synthesized'
    const { errors } = validateGoldenSet(broken)
    expect(errors.some(e => e.includes('已有 sampleAnswer'))).toBe(true)
  })

  it('标签未归一化 → 报错', () => {
    const broken = loadGoldenSet()
    firstGold(broken).tags = ['语法']
    const { errors } = validateGoldenSet(broken)
    expect(errors.some(e => e.includes('标签未归一化'))).toBe(true)
  })

  it('strict 模式把 warning 也算作错误', () => {
    const broken = loadGoldenSet()
    firstGold(broken).expectedPoints = ['只有一个要点']
    expect(validateGoldenSet(broken, { strict: true }).errors.length).toBeGreaterThan(0)
  })
})
