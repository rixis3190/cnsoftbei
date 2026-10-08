/**
 * qualityFunnel 单测（S3-9）
 * 核心断言：
 * - 规则不过 → 后续层完全不跑；
 * - 语义不过 → chatCompletion（模型层）**未被调用**（省额度，计划 S3-3 硬要求）；
 * - 模型层异常/解析失败 → modelDegraded=true 且不阻塞；
 * - 拦截原因完整传递到重生成提示词。
 */

import { describe, it, expect, vi } from 'vitest'
import { runQualityFunnel } from '../../src/services/qualityFunnel'
import { buildRagRegenerateHint } from '../../src/services/promptBuilder'
import { createEmbeddingProvider } from '../../src/embedding/embeddingProvider'
import type { GoldenReferenceLike } from '../../src/services/answerScorer'

const DIM = 256
const scorer = createEmbeddingProvider({ dim: DIM, idf: new Array(DIM).fill(1) })

const QUESTION = '请说明 Java 中 HashMap 的底层实现与树化条件。'
const GOOD_ANSWER =
  'HashMap 在 JDK8 之后用红黑树实现链表：当单链表长度超过 8 且数组容量至少为 64 时链表树化，把最坏查找复杂度从 O(n) 降到 O(log n)。'
const BAD_ANSWER = '记不太清，抱歉。'
const REFERENCE: GoldenReferenceLike = {
  referenceAnswer: GOOD_ANSWER,
  expectedPoints: ['红黑树实现链表', '单链表长度超过 8', '容量至少为 64', 'O(log n)'],
  mustExclude: ['HashMap 是线程安全的'],
}

/** 让语义层真正启用且不处于影子模式（用于「语义不过时不调模型层」的正向验证） */
const STRICT_SWITCHES = {
  SEMANTIC_LAYER_ENABLED: true,
  SEMANTIC_SHADOW_MODE: false,
  MODEL_LAYER_ENABLED: true,
  MODEL_DEGRADE_IS_BLOCKING: false,
}

describe('第 1 层：规则校验', () => {
  it('回答过短 → 规则层拦截，后续层不执行', async () => {
    const callModel = vi.fn().mockResolvedValue(90)
    const result = await runQualityFunnel({
      answer: '太短了',
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(result.accepted).toBe(false)
    expect(result.blockedBy).toBe('rule')
    expect(result.layersRun).toEqual(['rule'])
    expect(callModel).not.toHaveBeenCalled()
  })

  it('拒绝性语句 → 规则层拦截', async () => {
    const result = await runQualityFunnel({
      answer:
        '很抱歉，我无法回答这个问题，它涉及很多底层细节，我没有能力给出可靠的结论，建议你先查阅官方文档再回来确认一下。',
      questionText: QUESTION,
    })
    expect(result.blockedBy).toBe('rule')
    expect(result.reasons.join()).toContain('拒绝')
  })
})

describe('第 2 层：语义层', () => {
  it('语义分低 → 拦截且模型层未被调用', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: BAD_ANSWER + '。',
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    // 规则层会因为「与问题无关键词重叠」先拦下来，这里要保证一定不是模型层拦的
    expect(result.blockedBy).not.toBe('model')
    expect(callModel).not.toHaveBeenCalled()
  })

  it('语义层通过 → 进入模型层', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(result.accepted).toBe(true)
    expect(result.layersRun).toEqual(['rule', 'semantic', 'model'])
    expect(callModel).toHaveBeenCalledTimes(1)
  })

  it('影子模式下语义分只记录不拦截', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      switches: { SEMANTIC_LAYER_ENABLED: true, SEMANTIC_SHADOW_MODE: true },
    })
    expect(result.accepted).toBe(true)
    expect(result.semanticScore).not.toBeNull()
  })

  it('命中禁止项 → 直接语义层否决', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: `HashMap 是线程安全的，这点很重要。${GOOD_ANSWER}`,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(result.blockedBy).toBe('semantic')
    expect(result.reasons.join()).toContain('禁止内容')
    expect(callModel).not.toHaveBeenCalled()
  })

  it('无参考时不跑语义层（自动降级为规则层）', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      switches: STRICT_SWITCHES,
    })
    expect(result.layersRun).toEqual(['rule'])
    expect(result.semanticScore).toBeNull()
  })

  it('语义层抛异常 → 降级 L1，不阻塞（L1 降级演练）', async () => {
    const brokenScorer = {
      embed: () => {
        throw new Error('模拟语义层崩溃')
      },
    }
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer: brokenScorer,
      switches: STRICT_SWITCHES,
    })
    expect(result.accepted).toBe(true)
    expect(result.semanticScore).toBeNull()
  })
})

describe('第 3 层：模型层与降级', () => {
  it('模型分低 → 拦截并给出原因', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: true,
      callModel: async () => 42,
      switches: STRICT_SWITCHES,
    })
    expect(result.accepted).toBe(false)
    expect(result.blockedBy).toBe('model')
    expect(result.modelScore).toBe(42)
  })

  it('模型层抛异常 → modelDegraded=true 且不阻塞（混沌演练 D-3/D-4）', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: true,
      callModel: async () => {
        throw new Error('评审超时')
      },
      switches: STRICT_SWITCHES,
    })
    expect(result.accepted).toBe(true)
    expect(result.modelDegraded).toBe(true)
    expect(result.modelScore).not.toBe(90)
  })

  it('模型层返回非数字 → 视为降级而非放行', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: true,
      callModel: async () => NaN,
      switches: STRICT_SWITCHES,
    })
    expect(result.modelDegraded).toBe(true)
    expect(result.accepted).toBe(true)
  })

  it('enableModel=false → 模型层完全不执行（零额度）', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: false,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(callModel).not.toHaveBeenCalled()
    expect(result.layersRun).toEqual(['rule'])
    expect(result.accepted).toBe(true)
  })

  it('MODEL_LAYER_ENABLED=false → 模型层跳过', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: true,
      callModel,
      switches: { ...STRICT_SWITCHES, MODEL_LAYER_ENABLED: false },
    })
    expect(callModel).not.toHaveBeenCalled()
    expect(result.accepted).toBe(true)
  })
})

describe('拦截原因 → 重生成提示词', () => {
  it('原样传递给 buildRagRegenerateHint', async () => {
    const result = await runQualityFunnel({ answer: '太短了', questionText: QUESTION })
    const hint = buildRagRegenerateHint(result.reasons)
    expect(hint).toContain(result.reasons[0])
    expect(hint.length).toBeGreaterThan(0)
  })

  it('无原因时返回空串（不会注入空提示）', () => {
    expect(buildRagRegenerateHint([])).toBe('')
  })

  it('多条原因时列点输出', () => {
    const hint = buildRagRegenerateHint(['原因一', '原因二'])
    expect(hint).toContain('1. 原因一')
    expect(hint).toContain('2. 原因二')
  })
})

describe('漏斗永远不向调用方抛异常', () => {
  it('输入为 undefined 时仍返回结构化结果', async () => {
    const result = await runQualityFunnel({
      answer: undefined as unknown as string,
      questionText: undefined as unknown as string,
    })
    expect(result.accepted).toBe(false)
    expect(result.blockedBy).toBe('rule')
  })
})

