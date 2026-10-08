/**
 * 降级演练（Chaos Drill）—— 对应计划 §11 的 D-3 / D-4 与 §1.3 的可观测性硬约束
 *
 * 为什么单独成文件并落盘产物：
 * 计划 §1.3 要求「任何降级都必须能在 eval-report.html 中看到（降级率、触发次数），否则等于静默失效」。
 * 现状是：规则层否决与覆盖率不达标已在 golden-eval.json 有计数，检索无覆盖已在 rag-metrics.json 有计数，
 * 但 **L1（语义层异常）与 L2（模型层异常/解析失败）此前只写 console**，报告里看不到
 * （HANDOVER §13 B-27）。本文件把这两条路径**真实注入一遍**，把
 * 「注入次数 / 被正确标记次数 / 是否被误判为通过」落进 test-results/degradation-drill.json，
 * 由 scripts/gen-eval-report.ts 渲染成卡片。
 *
 * ⚠️ 口径（必须与报告卡片一致，勿夸大）：
 * 这是**能力演练**（证明降级分支存在且行为正确），**不是生产降级率** ——
 * 生产链路的 L2 降级率需要运行期埋点，当前未接入，卡片上会显式写明。
 *
 * 零额度：全部走注入的假 scorer / 假 callModel，不发生任何网络调用。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runQualityFunnel, type FunnelLayer, type FunnelResult } from '../../src/services/qualityFunnel'
import type { GoldenReferenceLike, SemanticScorer } from '../../src/services/answerScorer'
import { MODEL_DEGRADE_SCORE, SEMANTIC_PASS_SCORE } from '../../src/config/qualityThresholds'

const ALL_LAYERS: FunnelLayer[] = ['rule', 'semantic', 'model']

/**
 * 通过规则层的回答。
 * 注意 `validateAnswerRules` 的第一条硬规则是「回答 ≥50 字」——
 * fixture 太短会**在规则层就被拦下**，后面的 L1/L2 演练根本走不到（第一版就是这么挂的）。
 */
const ANSWER =
  '封装就是把数据和对数据的操作放在一起，对外只暴露必要的方法，隐藏内部实现细节；这样调用方不需要关心内部怎么实现，修改内部实现也不会影响使用它的代码。'

/**
 * 让语义层**真正执行**的开关组合。
 * 踩过的坑：`EVAL_SWITCHES.SEMANTIC_LAYER_ENABLED` 的默认值是 **false**
 * （src/config/evalConfig.ts —— 实施计划 §1.2 表格里写的 true 与代码不一致，**以代码为准**），
 * 不显式打开话语义层会被记入 layersSkipped，L1 演练根本走不到。
 */
const SEMANTIC_ON = {
  SEMANTIC_LAYER_ENABLED: true,
  SEMANTIC_SHADOW_MODE: false,
  MODEL_LAYER_ENABLED: true,
  MODEL_DEGRADE_IS_BLOCKING: false,
}

const REFERENCE: GoldenReferenceLike = {
  referenceAnswer: '封装就是把数据和对数据的操作放在一起，隐藏内部实现细节。',
  expectedPoints: ['数据与操作放在一起', '隐藏内部实现细节'],
  mustExclude: ['封装就是把所有字段设为 public'],
}

/** 正常打分的 provider（确定性哈希，不依赖任何模型） */
function makeScorer(): SemanticScorer {
  // 极简确定性向量：按码点映射到 8 维并归一化。只用于「能算出分」这一前提。
  return {
    embed(text: string): Float32Array {
      const v = new Float32Array(8)
      for (const ch of text) v[ch.codePointAt(0)! % 8] += 1
      const norm = Math.hypot(...v) || 1
      for (let i = 0; i < v.length; i++) v[i] /= norm
      return v
    },
  }
}

/** 注入用：向量计算直接抛异常（演练 L1） */
const throwingScorer: SemanticScorer = {
  embed(): Float32Array {
    throw new Error('注入：向量计算异常（演练 L1）')
  },
}

/** 全层状态不变量：run ∪ skipped = 三层，且两者不相交 */
function assertLayerInvariant(result: FunnelResult, where: string): void {
  const run = [...result.layersRun].sort()
  const skipped = [...result.layersSkipped].sort()
  const union = [...new Set([...run, ...skipped])].sort()
  expect(union, `${where}: run ∪ skipped 必须覆盖三层`).toEqual([...ALL_LAYERS].sort())
  expect(run.filter(l => skipped.includes(l)), `${where}: run 与 skipped 不能重叠`).toEqual([])
}

describe('降级演练（Chaos Drill，零额度）', () => {
  it('L1：语义层抛异常 → 只记录不拦截，且不伪装成「语义层通过」', async () => {
    const result = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: throwingScorer,
      switches: SEMANTIC_ON,
    })

    // 绝不把异常抛给调用方（计划 §1.3 实现约束）
    expect(result.accepted).toBe(true)
    expect(result.blockedBy).toBeNull()
    // 语义层「进入执行过」要留痕，同时语义分必须是 null（不能伪装成有分）
    expect(result.layersRun).toContain('semantic')
    expect(result.semanticScore).toBeNull()
    expect(result.semanticAvailable).toBe(false)
    assertLayerInvariant(result, 'L1')
  })

  it('L2：模型层抛异常 → modelDegraded=true，默认不阻塞', async () => {
    const result = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => {
        throw new Error('注入：评审超时（演练 L2）')
      },
      switches: SEMANTIC_ON,
    })

    expect(result.modelDegraded).toBe(true)
    expect(result.modelScore).toBe(MODEL_DEGRADE_SCORE)
    // 默认 MODEL_DEGRADE_IS_BLOCKING=false → 用户不该被阻塞
    expect(result.accepted).toBe(true)
    expect(result.blockedBy).toBeNull()
    assertLayerInvariant(result, 'L2-throw')
  })

  it('L2：模型层返回非数字（评审输出「这道题很好」）→ 同样降级而非伪装通过', async () => {
    const result = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => Number.NaN,
      switches: SEMANTIC_ON,
    })

    expect(result.modelDegraded).toBe(true)
    expect(result.accepted).toBe(true)
    assertLayerInvariant(result, 'L2-nan')
  })

  it('L2 + MODEL_DEGRADE_IS_BLOCKING=true → 降级按配置阻塞（否则该开关是假开关）', async () => {
    const result = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => {
        throw new Error('注入：评审失败（演练阻塞配置）')
      },
      switches: { ...SEMANTIC_ON, MODEL_DEGRADE_IS_BLOCKING: true },
    })

    expect(result.modelDegraded).toBe(true)
    expect(result.accepted).toBe(false)
    expect(result.blockedBy).toBe('model')
    expect(result.reasons.join('')).toContain('要求降级必须阻塞')
    assertLayerInvariant(result, 'L2-blocking')
  })

  it('无参考 → 语义层被跳过并留痕（「没跑」与「通过」必须可区分）', async () => {
    const result = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      scorer: makeScorer(),
      switches: SEMANTIC_ON,
    })

    expect(result.layersSkipped).toContain('semantic')
    expect(result.semanticScore).toBeNull()
    expect(result.accepted).toBe(true)
    assertLayerInvariant(result, 'no-reference')
  })

  it('产出 test-results/degradation-drill.json（供评测报告渲染降级卡片）', async () => {
    // 重新跑一遍需要计数的那几条路径，保证产物与上面的断言同源
    const l1 = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: throwingScorer,
      switches: SEMANTIC_ON,
    })
    const l2Throw = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => {
        throw new Error('演练：超时')
      },
      switches: SEMANTIC_ON,
    })
    const l2Nan = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => Number.NaN,
      switches: SEMANTIC_ON,
    })
    const l2Blocking = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      reference: REFERENCE,
      scorer: makeScorer(),
      enableModel: true,
      callModel: async () => {
        throw new Error('演练：阻塞')
      },
      switches: { ...SEMANTIC_ON, MODEL_DEGRADE_IS_BLOCKING: true },
    })
    const noReference = await runQualityFunnel({
      answer: ANSWER,
      questionText: REFERENCE.referenceAnswer,
      scorer: makeScorer(),
      switches: SEMANTIC_ON,
    })

    const l1Flagged = l1.layersRun.includes('semantic') && l1.semanticScore === null ? 1 : 0
    const l2Injected = 2 // 抛异常 + 返回非数字
    const l2Flagged = [l2Throw, l2Nan].filter(r => r.modelDegraded && r.modelScore === MODEL_DEGRADE_SCORE).length
    const l2Blocked = l2Blocking.accepted === false && l2Blocking.blockedBy === 'model' ? 1 : 0
    const skippedRecorded = noReference.layersSkipped.includes('semantic') ? 1 : 0

    // 演练必须真的证明了「注入会被标记」，否则产物本身没有意义
    expect(l1Flagged).toBe(1)
    expect(l2Flagged).toBe(l2Injected)
    expect(l2Blocked).toBe(1)
    expect(skippedRecorded).toBe(1)

    const outDir = path.resolve(process.cwd(), 'test-results')
    mkdirSync(outDir, { recursive: true })
    const payload = {
      generatedAt: new Date().toISOString(),
      drill: {
        l1SemanticFallback: {
          injected: 1,
          flagged: l1Flagged,
          behavior: '捕获异常 → 只记录不拦截；semanticScore 保持 null，不伪装成「语义层通过」',
        },
        l2ModelFallback: {
          injected: l2Injected,
          flagged: l2Flagged,
          degradeScore: MODEL_DEGRADE_SCORE,
          behavior: '评审异常/非数字 → modelDegraded=true 且默认不阻塞用户',
        },
        l2BlockingSwitch: {
          injected: 1,
          blocked: l2Blocked,
          behavior: 'MODEL_DEGRADE_IS_BLOCKING=true 时降级改为阻塞（防止假开关）',
        },
        semanticSkippedWithoutReference: {
          cases: 1,
          recorded: skippedRecorded,
          behavior: '无参考时语义层记入 layersSkipped，「没跑」与「通过」可区分',
        },
      },
      thresholds: { semanticPassScore: SEMANTIC_PASS_SCORE },
      note:
        '本文件是**降级能力演练**结果（注入故障 → 校验是否被正确标记），**不是生产降级率**。' +
        '生产链路的 L1/L2 降级率需要运行期埋点，当前未接入；' +
        '生产链路本身也不注入 reference/scorer，语义层在 Tutor 里恒为 skipped。',
    }
    const file = path.join(outDir, 'degradation-drill.json')
    writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

    const written = JSON.parse(readFileSync(file, 'utf8'))
    expect(written.drill.l2ModelFallback.flagged).toBe(written.drill.l2ModelFallback.injected)
    expect(written.note).toContain('不是生产降级率')
  })
})
