/**
 * answerScorer — 语义层打分（纯函数）
 *
 * 打分口径（0~100），三项合成：
 *   1) 余弦相似度：回答 vs 参考答案/三档锚点，取最高与平均（用向量 provider，特征哈希）；
 *   2) 要点覆盖率：expectedPoints 命中比例（无要点时该项不计，权重归给余弦）；
 *   3) 禁止项：**硬否决** —— 命中即 total = 0。
 *
 * 重要边界（面试会被追问）：
 * 余弦相似度衡量的是「表述相近」而不是「事实正确」，
 * 所以它**不能单独当质量判据**，必须与要点覆盖、禁止项组合使用。
 * 这也是语义层默认影子模式的原因（计划 T3-1）。
 *
 * 稳定性要求：任何异常输入（空文本、NaN、超长）都必须返回合法分数，
 * total 恒在 [0,100]（混沌演练 D-9）。
 */

import { coverageRatio, hitsMustExclude, scorablePoints } from './textMatch'
import { cosineDot } from '../embedding/vectorStore'

/** 语义层需要的最小参考结构（运行期只有参考答案，评测期才有要点/锚点） */
export interface GoldenReferenceLike {
  referenceAnswer: string
  expectedPoints?: readonly string[]
  mustExclude?: readonly string[]
  anchors?: { excellent: string; fair: string; poor: string }
}

/** 注入的向量化器：必须用构建期同一份 idf，否则与阈值口径不一致（T-2） */
export interface SemanticScorer {
  embed(text: string): Float32Array
}

export interface AnswerScore {
  /** 0~100，恒定合法 */
  total: number
  /** 与参考/锚点的最高余弦相似度 0~1 */
  cosineBest: number
  /** 与参考/锚点的平均余弦相似度 0~1 */
  cosineAvg: number
  /** 已覆盖的要点 */
  mustIncludeCovered: string[]
  /** 未覆盖的要点 */
  mustIncludeMissing: string[]
  /** 命中的禁止项 */
  mustExcludeHits: string[]
  /** 禁止项是否触发硬否决 */
  vetoed: boolean
  /** 语义分是否可用（缺 provider 时为 false，此时 total 只由覆盖率决定） */
  semanticAvailable: boolean
}

/** 要点存在时的权重：余弦 0.55 / 覆盖率 0.45 */
const WEIGHT_WITH_POINTS = { semantic: 0.55, coverage: 0.45 }

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 计算回答与一组目标的余弦相似度（目标为空或 provider 缺失时返回 null） */
function cosineAgainst(
  answer: string,
  targets: readonly string[],
  scorer: SemanticScorer | undefined,
): { best: number; avg: number } | null {
  if (!scorer) return null
  const usable = targets.filter(t => t && t.trim().length > 0)
  if (usable.length === 0) return null
  const answerVector = scorer.embed(answer)
  if (!answerVector || answerVector.every(v => v === 0)) return null
  let best = 0
  let sum = 0
  for (const target of usable) {
    const targetVector = scorer.embed(target)
    const score = clamp01(cosineDot(answerVector, targetVector))
    if (score > best) best = score
    sum += score
  }
  return { best, avg: sum / usable.length }
}

export interface ScoreAnswerOptions {
  /** 注入向量 provider；不传则只算覆盖率（离线纯规则场景） */
  scorer?: SemanticScorer
  /** 是否启用禁止项硬否决，默认 true */
  useVeto?: boolean
}

export function scoreAnswer(
  answer: string,
  reference: GoldenReferenceLike,
  options: ScoreAnswerOptions = {},
): AnswerScore {
  const { scorer, useVeto = true } = options
  const text = answer ?? ''

  // 1) 禁止项
  const mustExcludeHits = useVeto ? hitsMustExclude(text, reference.mustExclude ?? []) : []

  // 2) 要点覆盖
  const points = reference.expectedPoints ?? []
  const coverage = coverageRatio(points, text)
  const covered: string[] = []
  const missing: string[] = []
  // 与 coverageRatio 严格同口径：剔除「答题要求」类要点，
  // 否则它们会落进 missing，让重生成提示出现
  // 「回答未覆盖关键要点：（答题要求）结论要与参考答案一致」这种自相矛盾的指令（评审 MINOR-5）。
  const scoredPoints = scorablePoints(points)
  for (const point of scoredPoints) {
    // 单条要点覆盖率 > 0 即视为覆盖
    if (coverageRatio([point], text) > 0) covered.push(point)
    else missing.push(point)
  }

  // 3) 余弦：评测期用 excellent/fair 作参照，运行期只有参考答案。
  //    **poor 锚点刻意不作为相似度目标** —— 否则一条差答案会因为「和 poor 锚点一模一样」
  //    而拿到满分，阈值标定会得出 J=0 的假结论（这是实测踩到的坑）。
  const targets = reference.anchors
    ? [reference.anchors.excellent, reference.anchors.fair, reference.referenceAnswer]
    : [reference.referenceAnswer]
  const cosines = cosineAgainst(text, targets, scorer)

  // 4) 合成：有要点 → 0.55×余弦 + 0.45×覆盖率；无要点 → 纯余弦
  let total: number
  if (cosines) {
    total =
      // 用 scoredPoints 判权重归属：若要点全是「答题要求」类填充项，
      // coverage 恒为 0，此时权重应全部归余弦（与下方注释口径一致）
      scoredPoints.length > 0
        ? 100 * (WEIGHT_WITH_POINTS.semantic * cosines.best + WEIGHT_WITH_POINTS.coverage * coverage)
        : 100 * cosines.best
  } else {
    // 没有 provider：退化为纯覆盖率（降级链 L4），并明确标记语义分不可用。
    // 注意此时若连可用要点都没有，total 会是 0 —— 但语义层不可用时漏斗不会用阈值拦截，
    // 所以这个 0 不会造成误杀（见 qualityFunnel 的 semanticAvailable 分支）。
    total = 100 * coverage
  }

  if (mustExcludeHits.length > 0) total = 0
  if (!Number.isFinite(total)) total = 0

  return {
    total: Math.max(0, Math.min(100, total)),
    cosineBest: cosines?.best ?? 0,
    cosineAvg: cosines?.avg ?? 0,
    mustIncludeCovered: covered,
    mustIncludeMissing: missing,
    mustExcludeHits,
    vetoed: mustExcludeHits.length > 0,
    semanticAvailable: cosines !== null,
  }
}
