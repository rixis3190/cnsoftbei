/**
 * qualityFunnel 单测（S3-9）
 * 核心断言：
 * - 规则不过 → 后续层完全不跑（用 layersRun / layersSkipped 精确断言，不用「不是模型层拦的」这种永真句式）；
 * - 语义不过 → chatCompletion（模型层）**未被调用**（省额度，计划 S3-3 硬要求），
 *   样本必须能过规则层，否则断言退化为永真；
 * - 模型层异常/解析失败 → modelDegraded=true，默认不阻塞、开关打开时阻塞；
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
/**
 * 刻意构造的「过规则层、但语义分极低」样本（65 字）。
 * 用于把「语义层拦截」与「规则层拦截」区分开 —— 用 BAD_ANSWER 这类短回答测语义层，
 * 实际永远在规则层就被拦下，断言会退化成永真（评审 MAJOR-7）。
 * 实测语义分 total≈14.5（阈值 61）。
 */
const RULE_PASSING_LOW_SEMANTIC =
  '这个问题涉及 Java 集合框架的底层结构，回答的时候需要结合源码中的具体实现来说明一下相关的细节内容。'
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
  it('规则层拦截时，语义与模型层都不执行', async () => {
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: BAD_ANSWER,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(result.blockedBy).toBe('rule')
    expect(result.layersRun).toEqual(['rule'])
    expect(result.layersSkipped).toEqual(['semantic', 'model'])
    expect(callModel).not.toHaveBeenCalled()
  })

  it('语义分低 → 语义层拦截，模型层未被调用（省额度硬要求）', async () => {
    // 该样本 65 字、过了规则层，但与参考答案语义几乎无关，语义分必然低于阈值：
    // 实测 total≈14.5（阈值 61），确保拦截发生在**语义层**而不是规则层。
    const callModel = vi.fn().mockResolvedValue(95)
    const result = await runQualityFunnel({
      answer: RULE_PASSING_LOW_SEMANTIC,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      enableModel: true,
      callModel,
      switches: STRICT_SWITCHES,
    })
    expect(result.blockedBy).toBe('semantic')
    expect(result.layersRun).toEqual(['rule', 'semantic'])
    expect(result.semanticScore).not.toBeNull()
    expect(result.semanticScore!).toBeLessThan(61)
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

  it('影子模式：同一个低分回答「关影子会被拦、开影子会放行」（配对断言）', async () => {
    // 用低分样本做配对，否则「影子模式不拦截」在好回答上恒真，测不出任何东西。
    const strict = await runQualityFunnel({
      answer: RULE_PASSING_LOW_SEMANTIC,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      switches: { SEMANTIC_LAYER_ENABLED: true, SEMANTIC_SHADOW_MODE: false },
    })
    expect(strict.accepted).toBe(false)
    expect(strict.blockedBy).toBe('semantic')

    const shadow = await runQualityFunnel({
      answer: RULE_PASSING_LOW_SEMANTIC,
      questionText: QUESTION,
      reference: REFERENCE,
      scorer,
      switches: { SEMANTIC_LAYER_ENABLED: true, SEMANTIC_SHADOW_MODE: true },
    })
    expect(shadow.accepted).toBe(true)
    expect(shadow.blockedBy).toBeNull()
    // 影子模式下分数照算（可观测），且与严格模式完全一致
    expect(shadow.semanticScore).toBe(strict.semanticScore)
    expect(shadow.semanticScore).not.toBeNull()
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
    expect(result.layersSkipped).toContain('semantic')
    expect(result.semanticScore).toBeNull()
  })

  it('语义分不可用（缺 provider）→ 不伪装拦截，且未执行的模型层被记录', async () => {
    // 不注入 scorer：scoreAnswer 会返回 semanticAvailable=false，
    // 此时阈值判定被短路，必须能从结果里看出「语义层跑了但没有效分数」。
    const result = await runQualityFunnel({
      answer: RULE_PASSING_LOW_SEMANTIC,
      questionText: QUESTION,
      reference: REFERENCE,
      switches: { SEMANTIC_LAYER_ENABLED: true, SEMANTIC_SHADOW_MODE: false },
    })
    expect(result.layersRun).toEqual(['rule', 'semantic'])
    expect(result.semanticAvailable).toBe(false)
    // 明确的放行断言：不是「恰好没被拦」，而是确实接受了
    expect(result.accepted).toBe(true)
    expect(result.blockedBy).toBeNull()
    expect(result.layersSkipped).toEqual(['model'])
  })

  it('层状态不变量：run ∪ skipped = {rule, semantic, model} 且互不重叠', async () => {
    const cases = [
      { name: '规则层拦截', input: { answer: '太短', questionText: QUESTION } },
      {
        name: '语义层拦截',
        input: {
          answer: RULE_PASSING_LOW_SEMANTIC,
          questionText: QUESTION,
          reference: REFERENCE,
          scorer,
          switches: STRICT_SWITCHES,
        },
      },
      {
        name: '语义层不可用',
        input: {
          answer: RULE_PASSING_LOW_SEMANTIC,
          questionText: QUESTION,
          reference: REFERENCE,
          switches: { SEMANTIC_LAYER_ENABLED: true, SEMANTIC_SHADOW_MODE: false },
        },
      },
      { name: '模型层未启用', input: { answer: GOOD_ANSWER, questionText: QUESTION, switches: STRICT_SWITCHES } },
      {
        name: '模型层异常',
        input: {
          answer: GOOD_ANSWER,
          questionText: QUESTION,
          enableModel: true,
          callModel: async () => {
            throw new Error('评审超时')
          },
          switches: STRICT_SWITCHES,
        },
      },
    ]
    for (const { name, input } of cases) {
      const result = await runQualityFunnel(input)
      const union = new Set([...result.layersRun, ...result.layersSkipped])
      expect(union, `${name}：未覆盖的层`).toEqual(new Set(['rule', 'semantic', 'model']))
      for (const layer of result.layersRun) {
        expect(result.layersSkipped, `${name}：${layer} 同时出现在 run 与 skipped`).not.toContain(layer)
      }
    }
  })

  it('MODEL_DEGRADE_IS_BLOCKING=true 时模型层降级会阻塞（开关真的生效）', async () => {
    const result = await runQualityFunnel({
      answer: GOOD_ANSWER,
      questionText: QUESTION,
      enableModel: true,
      callModel: async () => {
        throw new Error('评审超时')
      },
      switches: { ...STRICT_SWITCHES, MODEL_DEGRADE_IS_BLOCKING: true },
    })
    expect(result.modelDegraded).toBe(true)
    expect(result.accepted).toBe(false)
    expect(result.blockedBy).toBe('model')
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

