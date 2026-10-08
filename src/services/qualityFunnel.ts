/**
 * qualityFunnel — 规则 → 语义 → 模型 三级质量漏斗
 *
 * 设计契约（计划 §1.3 / S3-3）：
 * 1. **绝不把异常抛给调用方**。语义层与模型层各自 try/catch，失败只记 warn 并降级；
 * 2. **规则不过 → 立即返回**，不跑后面的层（省钱且无意义）；
 * 3. **语义层不过 → 不调模型层**（省额度，计划 S3-3 明确要求，有单测断言 chatCompletion 未被调用）；
 * 4. 模型层异常/解析失败 → `modelDegraded=true`，**不阻塞**用户（默认 MODEL_DEGRADE_IS_BLOCKING=false），
 *    绝不「伪装通过」：降级率会进入报告，兜底必须可观测；
 * 5. 影子模式下语义分照算但只记录，不参与拦截。
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
  let semanticScore: number | null = null
  let semanticAvailable = false

  // ---- 第 2 层：语义 ----
  if (reference && switches.SEMANTIC_LAYER_ENABLED) {
    try {
      const scored = scoreAnswer(answer, reference, { scorer })
      semanticScore = scored.total
      semanticAvailable = scored.semanticAvailable
      layersRun.push('semantic')

      // 命中禁止项 = 硬否决，与阈值无关
      if (scored.vetoed) {
        return ok({
          accepted: false,
          blockedBy: 'semantic',
          reasons: [`回答包含禁止内容：${scored.mustExcludeHits.join('、')}`],
          semanticScore,
          semanticAvailable,
          layersRun,
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
        })
      }
    } catch (error) {
      // L1 降级：语义层异常只记录，不阻塞
      console.warn('[QualityFunnel] 语义层异常，降级 L1', error)
    }
  }

  // ---- 第 3 层：模型 ----
  if (!switches.MODEL_LAYER_ENABLED || !enableModel || !callModel) {
    return Promise.resolve(
      ok({ semanticScore, semanticAvailable, layersRun, ruleReason: null }),
    )
  }

  try {
    const modelScore = await callModel(answer, questionText)
    layersRun.push('model')
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
        }),
      )
    }
    return Promise.resolve(
      ok({ semanticScore, semanticAvailable, modelScore, layersRun }),
    )
  } catch (error) {
    // L2 降级：评审失败不阻塞，但必须标记降级（报告里可见）
    console.warn('[QualityFunnel] 模型层异常，降级 L2', error)
    return ok({
      semanticScore,
      semanticAvailable,
      modelDegraded: true,
      modelScore: MODEL_DEGRADE_SCORE,
      layersRun,
    })
  }
}

function buildSemanticReasons(missing: readonly string[]): string[] {
  if (missing.length === 0) return ['回答与参考答案差异过大']
  const head = missing.slice(0, 3).join('、')
  return [`回答未覆盖关键要点：${head}${missing.length > 3 ? ' 等' : ''}`]
}
