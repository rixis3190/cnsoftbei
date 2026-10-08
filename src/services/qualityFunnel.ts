/**
 * qualityFunnel — 规则 → 语义 → 模型 三级质量漏斗
 *
 * 设计契约（计划 §1.3 / S3-3）：
 * 1. **绝不把异常抛给调用方**。语义层与模型层各自 try/catch，失败只记 warn 并降级；
 * 2. **规则不过 → 立即返回**，不跑后面的层（省钱且无意义）；
 * 3. **语义层不过 → 不调模型层**（省额度，计划 S3-3 明确要求，有单测断言 chatCompletion 未被调用）；
 * 4. 模型层异常/解析失败 → `modelDegraded=true`，**默认不阻塞**用户
 *    （`MODEL_DEGRADE_IS_BLOCKING=true` 时才阻塞，见该开关的接线）；
 * 5. 影子模式下语义分照算但只记录，不参与拦截；
 * 6. **「没跑」与「通过」必须可区分**：未执行的层记入 `layersSkipped`，
 *    语义分不可用（缺 provider / 零向量）会显式 warn，不许静默放行。
 *
 * 观测口径：调用方应把 `layersSkipped`、`modelDegraded`、`semanticAvailable`
 * 计入降级率统计（Tutor.tsx 已有 console 输出；eval 报告侧见 docs/eval-methodology.md）。
 */

import { EVAL_SWITCHES } from '../config/evalConfig'
import { SEMANTIC_PASS_SCORE, MODEL_PASS_SCORE, MODEL_DEGRADE_SCORE } from '../config/qualityThresholds'
import { scoreAnswer, type GoldenReferenceLike, type SemanticScorer } from './answerScorer'
import { validateAnswerRules } from './tutorQuality'

export type FunnelLayer = 'rule' | 'semantic' | 'model'

export interface FunnelInput {
  /** 候选回答 */
  answer: string
  /** 题干（规则层关键词重叠校验用） */
  questionText: string
  /** 参考答案/锚点；缺省时语义层自动跳过 */
  reference?: GoldenReferenceLike
  /** 注入向量 provider（与构建期同一份 idf） */
  scorer?: SemanticScorer
  /** 是否允许调用模型层；默认 false（离线评测与单测都不该真调） */
  enableModel?: boolean
  /** 模型层调用（默认关闭；注入后由外部决定真实 LLM 还是 mock） */
  callModel?: (answer: string, questionText: string) => Promise<number>
  /** 覆盖全局开关（单测用） */
  switches?: Partial<typeof EVAL_SWITCHES>
}

export interface FunnelResult {
  /** 是否接受该回答 */
  accepted: boolean
  /** 拦截发生在哪一层 */
  blockedBy: FunnelLayer | null
  /** 拦截原因（用于重生成提示词） */
  reasons: string[]
  /** 规则层得分（0~100，无参考时为 null） */
  semanticScore: number | null
  /** 语义层是否可用（有参考且有 provider） */
  semanticAvailable: boolean
  /** 模型层是否降级（异常/解析失败） */
  modelDegraded: boolean
  /** 模型层得分（未执行时为 null） */
  modelScore: number | null
  /** 各层执行情况，便于报告统计 */
  layersRun: FunnelLayer[]
  /**
   * 未执行的层（含原因可推断）：「语义层通过」与「语义层没跑」必须可区分，
   * 否则降级不可观测（评审 MAJOR-3）。
   */
  layersSkipped: FunnelLayer[]
  /** 规则层原始校验结果 */
  ruleReason: string | null
}

function ok(partial: Partial<FunnelResult> = {}): FunnelResult {
  return {
    accepted: true,
    blockedBy: null,
    reasons: [],
    semanticScore: null,
    semanticAvailable: false,
    modelDegraded: false,
    modelScore: null,
    layersRun: [],
    layersSkipped: [],
    ruleReason: null,
    ...partial,
  }
}

export function runQualityFunnel(input: FunnelInput): Promise<FunnelResult> {
  const switches = { ...EVAL_SWITCHES, ...(input.switches ?? {}) }
  const { answer, questionText, reference, scorer, enableModel = false, callModel } = input

  // ---- 第 1 层：规则（零成本，永远先跑） ----
  const ruleCheck = validateAnswerRules(answer, questionText)
  if (!ruleCheck.pass) {
    return Promise.resolve(
      ok({
        accepted: false,
        blockedBy: 'rule',
        reasons: [ruleCheck.reason ?? '规则校验未通过'],
        layersRun: ['rule'],
        layersSkipped: ['semantic', 'model'],
        ruleReason: ruleCheck.reason ?? null,
      }),
    )
  }

  return runSemanticAndModel(answer, questionText, reference, scorer, enableModel, callModel, switches)
}

async function runSemanticAndModel(
  answer: string,
  questionText: string,
  reference: GoldenReferenceLike | undefined,
  scorer: SemanticScorer | undefined,
  enableModel: boolean,
  callModel: ((answer: string, questionText: string) => Promise<number>) | undefined,
  switches: typeof EVAL_SWITCHES,
): Promise<FunnelResult> {
  const layersRun: FunnelLayer[] = ['rule']
  const layersSkipped: FunnelLayer[] = []
  let semanticScore: number | null = null
  let semanticAvailable = false

  // ---- 第 2 层：语义 ----
  if (!reference || !switches.SEMANTIC_LAYER_ENABLED) {
    // 显式记录「为什么没跑」，否则「语义层通过」与「语义层没跑」在下游完全同形，
    // 这正是「绝不伪装通过」要避免的静默失效（评审 MAJOR-3）。
    layersSkipped.push('semantic')
    if (reference && !switches.SEMANTIC_LAYER_ENABLED) {
      console.warn('[QualityFunnel] 语义层开关关闭，本次跳过语义层')
    }
  } else {
    try {
      const scored = scoreAnswer(answer, reference, { scorer })
      semanticScore = scored.total
      semanticAvailable = scored.semanticAvailable
      layersRun.push('semantic')

      if (!semanticAvailable) {
        // 语义分不可用（缺 provider 或零向量）时阈值判定会被短路，
        // 必须显式告警，否则这是一个恒真的空转层。
        console.warn('[QualityFunnel] 语义分不可用（缺 embedding provider 或零向量），本次按规则层结果放行')
      }

      // 命中禁止项 = 硬否决，与阈值无关
      if (scored.vetoed) {
        return ok({
          accepted: false,
          blockedBy: 'semantic',
          reasons: [`回答包含禁止内容：${scored.mustExcludeHits.join('、')}`],
          semanticScore,
          semanticAvailable,
          layersRun,
          // 语义层否决时模型层同样没跑，必须记录（否则降级统计会低估）
          layersSkipped: ['model'],
        })
      }

      if (!switches.SEMANTIC_SHADOW_MODE && semanticAvailable && semanticScore < SEMANTIC_PASS_SCORE) {
        return ok({
          accepted: false,
          blockedBy: 'semantic',
          reasons: buildSemanticReasons(scored.mustIncludeMissing),
          semanticScore,
          semanticAvailable,
          layersRun,
          layersSkipped: ['model'],
        })
      }
    } catch (error) {
      // L1 降级：语义层异常只记录，不阻塞
      console.warn('[QualityFunnel] 语义层异常，降级 L1', error)
    }
  }

  // ---- 第 3 层：模型 ----
  if (!switches.MODEL_LAYER_ENABLED || !enableModel || !callModel) {
    layersSkipped.push('model')
    return Promise.resolve(
      ok({ semanticScore, semanticAvailable, layersRun, layersSkipped, ruleReason: null }),
    )
  }

  // 「模型层已执行」必须在调用**之前**记录：若 callModel 抛异常，
  // 这一层确实已经被调用过，不能既不在 layersRun 也不在 layersSkipped 里凭空消失。
  layersRun.push('model')
  try {
    const modelScore = await callModel(answer, questionText)
    if (!Number.isFinite(modelScore)) throw new Error(`模型层返回非数字：${modelScore}`)
    if (modelScore < MODEL_PASS_SCORE) {
      return Promise.resolve(
        ok({
          accepted: false,
          blockedBy: 'model',
          reasons: [`模型评审得分 ${modelScore} 低于门槛 ${MODEL_PASS_SCORE}`],
          semanticScore,
          semanticAvailable,
          modelScore,
          layersRun,
          layersSkipped,
        }),
      )
    }
    return Promise.resolve(
      ok({ semanticScore, semanticAvailable, modelScore, layersRun, layersSkipped }),
    )
  } catch (error) {
    // L2 降级：评审失败默认不阻塞，但必须标记降级（报告里可见）。
    // MODEL_DEGRADE_IS_BLOCKING=true 时改为阻塞 —— 否则这个开关是「改了不生效」的假开关。
    console.warn('[QualityFunnel] 模型层异常，降级 L2', error)
    const blocking = switches.MODEL_DEGRADE_IS_BLOCKING
    return ok({
      accepted: !blocking,
      blockedBy: blocking ? 'model' : undefined,
      reasons: blocking ? ['模型评审不可用，且配置要求降级必须阻塞'] : undefined,
      semanticScore,
      semanticAvailable,
      modelDegraded: true,
      modelScore: MODEL_DEGRADE_SCORE,
      layersRun,
      layersSkipped,
    })
  }
}

function buildSemanticReasons(missing: readonly string[]): string[] {
  if (missing.length === 0) return ['回答与参考答案差异过大']
  const head = missing.slice(0, 3).join('、')
  return [`回答未覆盖关键要点：${head}${missing.length > 3 ? ' 等' : ''}`]
}
