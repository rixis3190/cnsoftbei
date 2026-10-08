/**
 * ragMetrics — RAG 评测指标（纯函数，口径写在注释里，面试会被追问）
 *
 * 口径定义：
 * - `Recall@k = |retrieved∩gold| / |gold|`
 *   注意分母是**标注的金标块数**，不是查询数；多金标时是「召回率」而非「命中率」。
 * - `MRR = 1/|gold| × Σ 1/rank_i`，rank_i 是该金标块的**首个命中位**（1 起），
 *   未命中记 0；因此 MRR ≤ 1，且比 Recall 更看重「排在前面」。
 * - `DCG@k = Σ_{i=1..k} rel_i / log2(i+1)`，`rel_i ∈ {0,1}`（命中即 1，不按相关度分级，
 *   因为语料是一题一 chunk，没有细粒度相关度标注）；`IDCG@k` 用理想排序计算，
 *   `NDCG@k = DCG@k / IDCG@k`。
 * - `faithfulness = 被支撑断言句数 / 总断言句数`
 *   切句只按中文句号/问号/分号（粗粒度是**已知局限**，必须在报告里注明）。
 *   「被支撑」= 该句与某个片段的余弦相似度 ≥ 阈值。
 *
 * 重要边界：faithfulness 用余弦做蕴含判断本身就有局限（计划 S4-R8），
 * 区分度不足时**只当观测指标，不进 CI 门禁**。
 */

import { cosineDot } from '../embedding/vectorStore'
import type { SemanticScorer } from '../services/answerScorer'

export interface RankedHit {
  /** 片段 id */
  id: string
  score: number
}

/** 召回率：|retrieved∩gold| / |gold| */
export function recallAtK(retrieved: readonly RankedHit[], gold: readonly string[], k: number): number {
  if (gold.length === 0) return 0
  const top = new Set(retrieved.slice(0, k).map(hit => hit.id))
  let hit = 0
  for (const id of gold) if (top.has(id)) hit++
  return hit / gold.length
}

/** 平均倒数排名：多金标取「首个命中位」的倒数之和 */
export function mrr(retrieved: readonly RankedHit[], gold: readonly string[], k: number): number {
  if (gold.length === 0) return 0
  const top = retrieved.slice(0, k)
  let sum = 0
  for (const id of gold) {
    const rank = top.findIndex(hit => hit.id === id)
    if (rank >= 0) sum += 1 / (rank + 1)
  }
  return sum / gold.length
}

function dcg(ranks: readonly number[], k: number): number {
  let sum = 0
  for (const rank of ranks.slice(0, k)) sum += 1 / Math.log2(rank + 1)
  return sum
}

/** NDCG@k（二值相关度） */
export function ndcgAtK(retrieved: readonly RankedHit[], gold: readonly string[], k: number): number {
  if (gold.length === 0) return 0
  const top = retrieved.slice(0, k)
  const ranks: number[] = []
  for (let i = 0; i < top.length; i++) {
    ranks.push(gold.includes(top[i].id) ? i + 1 : 0)
  }
  const idealCount = Math.min(gold.length, k)
  const idealRanks = Array.from({ length: idealCount }, (_, i) => i + 1)
  const idcg = dcg(idealRanks, k)
  return idcg === 0 ? 0 : dcg(ranks.filter(r => r > 0), k) / idcg
}

/** 按中文标点切句（只切这三类，刻意不切逗号：太碎会稀释支撑判定） */
export function splitSentences(text: string): string[] {
  return text
    .split(/[。？；!?;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export interface FaithfulnessResult {
  /** 被支撑句数 / 总句数 */
  score: number
  totalSentences: number
  supportedSentences: number
  /** 无支撑的断言句（供人工核对） */
  unsupported: string[]
  /** 判定阈值（写进报告，避免口径不明） */
  threshold: number
}

/**
 * 忠实度：逐句与所有片段求余弦，相似度 ≥ threshold 视为「被支撑」。
 * @param scorer 必须使用构建期同一份 idf，否则与检索口径不一致
 */
export function faithfulness(
  answer: string,
  chunkTexts: readonly string[],
  scorer: SemanticScorer,
  threshold = 0.5,
): FaithfulnessResult {
  const sentences = splitSentences(answer)
  if (sentences.length === 0 || chunkTexts.length === 0) {
    return { score: 0, totalSentences: sentences.length, supportedSentences: 0, unsupported: [...sentences], threshold }
  }
  const chunkVectors = chunkTexts.map(text => scorer.embed(text))
  const unsupported: string[] = []
  let supported = 0
  for (const sentence of sentences) {
    const vector = scorer.embed(sentence)
    let best = 0
    for (const chunkVector of chunkVectors) best = Math.max(best, cosineDot(vector, chunkVector))
    if (best >= threshold) supported++
    else unsupported.push(sentence)
  }
  return {
    score: supported / sentences.length,
    totalSentences: sentences.length,
    supportedSentences: supported,
    unsupported,
    threshold,
  }
}

