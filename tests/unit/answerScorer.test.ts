/**
 * answerScorer 单测（S3-9）
 * 关注：禁止项硬否决、覆盖率 0/全/部分、total 恒在 [0,100]、缺 reference 安全降级。
 */

import { describe, it, expect } from 'vitest'
import { scoreAnswer, type GoldenReferenceLike } from '../../src/services/answerScorer'
import { createEmbeddingProvider } from '../../src/embedding/embeddingProvider'

const DIM = 256
const scorer = createEmbeddingProvider({ dim: DIM, idf: new Array(DIM).fill(1) })

const REFERENCE: GoldenReferenceLike = {
  referenceAnswer:
    'Java 的 HashMap 在 JDK8 之后由红黑树实现链表，单链表长度超过 8 且容量满足条件时树化，从而避免最坏情况 O(n) 的查找。',
  expectedPoints: ['红黑树实现链表', '单链表长度超过 8', '树化', '避免 O(n) 查找'],
  mustExclude: ['HashMap 是线程安全的', 'HashMap 的 key 允许重复'],
  anchors: {
    excellent:
      'Java 的 HashMap 在 JDK8 之后由红黑树实现链表，单链表长度超过 8 且容量满足条件时树化，从而避免最坏情况 O(n) 的查找。',
    fair: 'HashMap 在 JDK8 之后用红黑树处理单链表长度超过 8 的情况，树化以优化查找。',
    poor: '记不太清，抱歉。',
  },
}

describe('scoreAnswer 基本性质', () => {
  it('total 恒在 [0,100]', () => {
    const samples = ['', 'a', '完全无关的回答', REFERENCE.referenceAnswer, REFERENCE.referenceAnswer.repeat(20)]
    for (const sample of samples) {
      const { total } = scoreAnswer(sample, REFERENCE, { scorer })
      expect(total).toBeGreaterThanOrEqual(0)
      expect(total).toBeLessThanOrEqual(100)
      expect(Number.isFinite(total)).toBe(true)
    }
  })

  it('优秀答案显著高于差答案', () => {
    const good = scoreAnswer(REFERENCE.anchors.excellent, REFERENCE, { scorer })
    const poor = scoreAnswer(REFERENCE.anchors.poor, REFERENCE, { scorer })
    expect(good.total).toBeGreaterThan(poor.total)
  })

  it('cosineBest ≥ cosineAvg，且都落在 0~1', () => {
    const result = scoreAnswer(REFERENCE.anchors.fair, REFERENCE, { scorer })
    expect(result.cosineBest).toBeGreaterThanOrEqual(result.cosineAvg)
    expect(result.cosineBest).toBeLessThanOrEqual(1)
    expect(result.cosineAvg).toBeGreaterThanOrEqual(0)
  })

  it('未提供 scorer 时语义分不可用且不抛错（降级 L4）', () => {
    const result = scoreAnswer(REFERENCE.anchors.excellent, REFERENCE)
    expect(result.semanticAvailable).toBe(false)
    expect(result.cosineBest).toBe(0)
    expect(Number.isFinite(result.total)).toBe(true)
  })

  it('空回答不抛错', () => {
    expect(() => scoreAnswer('', REFERENCE, { scorer })).not.toThrow()
  })
})

describe('禁止项硬否决', () => {
  it('命中禁止项 → total = 0 且 vetoed=true', () => {
    const result = scoreAnswer(
      `HashMap 的 key 允许重复，这题很简单。${REFERENCE.anchors.excellent}`,
      REFERENCE,
      { scorer },
    )
    expect(result.mustExcludeHits.length).toBeGreaterThan(0)
    expect(result.vetoed).toBe(true)
    expect(result.total).toBe(0)
  })

  it('正常回答不触发否决', () => {
    const result = scoreAnswer(REFERENCE.anchors.excellent, REFERENCE, { scorer })
    expect(result.mustExcludeHits).toEqual([])
    expect(result.vetoed).toBe(false)
  })

  it('useVeto=false 时不否决', () => {
    const result = scoreAnswer('HashMap 的 key 允许重复', REFERENCE, { scorer, useVeto: false })
    expect(result.vetoed).toBe(false)
  })
})

describe('要点覆盖', () => {
  it('全覆盖 → covered 完整、missing 为空', () => {
    const result = scoreAnswer(REFERENCE.anchors.excellent, REFERENCE, { scorer })
    expect(result.mustIncludeMissing).toEqual([])
    expect(result.mustIncludeCovered.length).toBe(REFERENCE.expectedPoints!.length)
  })

  it('完全不提要点 → covered 为空', () => {
    const result = scoreAnswer('抱歉，我不知道这个问题的答案。', REFERENCE, { scorer })
    expect(result.mustIncludeCovered).toEqual([])
    expect(result.mustIncludeMissing.length).toBe(REFERENCE.expectedPoints!.length)
  })

  it('部分覆盖 → covered 与 missing 都非空', () => {
    const result = scoreAnswer('HashMap 用红黑树来优化查找。', REFERENCE, { scorer })
    expect(result.mustIncludeCovered.length).toBeGreaterThan(0)
    expect(result.mustIncludeMissing.length).toBeGreaterThan(0)
  })

  it('无要点时覆盖率不参与（权重全给余弦）', () => {
    const result = scoreAnswer(REFERENCE.referenceAnswer, { referenceAnswer: REFERENCE.referenceAnswer }, { scorer })
    expect(result.mustIncludeCovered).toEqual([])
    expect(result.total).toBeGreaterThan(90)
  })

  it('要点全是「答题要求」填充项时，权重也全给余弦（不漏算 45%）', () => {
    // 生成器理论上不会产出这种条目（ensureMinPoints 先补参考答案类要点），
    // 但一旦阈值/评测口径遇到它，覆盖率恒为 0 会把总分静默压低 45%。
    const fillerOnly = {
      referenceAnswer: REFERENCE.referenceAnswer,
      expectedPoints: ['（答题要求）结论要与参考答案一致', '（答题要求）需结合题目条件判断'],
      mustExclude: [],
    }
    const withFiller = scoreAnswer(REFERENCE.referenceAnswer, fillerOnly, { scorer })
    const noPoints = scoreAnswer(REFERENCE.referenceAnswer, { referenceAnswer: REFERENCE.referenceAnswer }, { scorer })

    expect(withFiller.mustIncludeMissing).toEqual([])
    expect(withFiller.mustIncludeCovered).toEqual([])
    // 与「完全没有要点」等价：total 只由余弦决定
    expect(withFiller.total).toBeCloseTo(noPoints.total, 6)
  })
})

describe('混沌演练 D-9：异常输入', () => {
  it('NaN 不会污染 total', () => {
    const brokenScorer = {
      embed: () => Float32Array.from([NaN, NaN, NaN]),
    }
    const result = scoreAnswer('任意回答', REFERENCE, { scorer: brokenScorer })
    expect(Number.isFinite(result.total)).toBe(true)
    expect(result.total).toBeGreaterThanOrEqual(0)
  })

  it('零向量回答不会产生 NaN', () => {
    const result = scoreAnswer('，。；！？', REFERENCE, { scorer })
    expect(Number.isFinite(result.total)).toBe(true)
  })

  it('参考答案为空串时安全返回', () => {
    const result = scoreAnswer('任意回答', { referenceAnswer: '' }, { scorer })
    expect(Number.isFinite(result.total)).toBe(true)
    expect(result.semanticAvailable).toBe(false)
  })
})
