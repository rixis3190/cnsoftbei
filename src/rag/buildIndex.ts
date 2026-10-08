/**
 * buildIndex — 运行时索引加载与混合召回
 *
 * 降级契约（L3，计划 §1.3）：索引缺失 / id 不一致 / 解码失败时
 * `getIndex()` 返回 null，`retrieve()` 返回空数组并把 `ragUnavailable` 记进观测，
 * **绝不把异常抛给 UI，也绝不注入空上下文**。
 *
 * 模块级单例：JSON 导入与解码只做一次（解码 600×256 的 int8 约几毫秒，
 * 放进 useMemo 依赖里会因不稳定对象而反复重算）。
 */

import chunksJson from '../data/ragChunks.json'
import vectorsJson from '../data/ragVectors.json'
import { createEmbeddingProvider, type EmbeddingProvider } from '../embedding/embeddingProvider'
import { base64ToBytes, cosineDot, decodeVectors, QUANT_SCALE } from '../embedding/vectorStore'
import { jaccardSimilarity } from '../services/tutorQuality'
import { tokenize } from '../services/textMatch'
import type { RagChunk } from './corpusBuilder'

export interface RagVectorsManifest {
  dim: number
  /** 量化模型标识：目前只有 int8 + 全局 scale */
  model: string
  scale: number
  /** 与 dim 等长，构建期算出 */
  idf: number[]
  ids: string[]
  /** base64(int8 矩阵)，行优先 */
  vectors: string
  /** 产物内容哈希，用于 CI --check 校验 */
  hash: string
}

export interface RetrievedChunk {
  chunk: RagChunk
  score: number
  /** 余弦通道得分 */
  cosine: number
  /** 关键词通道得分 */
  keyword: number
}

export interface RetrieveOptions {
  topK?: number
  /** 命中分数下限，低于则视为「知识库无覆盖」 */
  floor?: number
  /** 关键词通道权重，其余权重给余弦 */
  keywordWeight?: number
  /** tag 前置过滤（命中这些标签的块才参与召回） */
  tagHint?: string[]
}

export const DEFAULT_TOP_K = 3
/** 关键词通道默认权重（余弦占 0.7） */
export const DEFAULT_KEYWORD_WEIGHT = 0.3

/**
 * 概览型提问的意图识别。
 * 「XX 这个主题整体讲了什么」与「某个具体问题」需要的块类型不同：
 * 前者要 tag 概览块，后者要题目块。纯 n-gram 相似度区分不了这两种意图
 * （实测概览型查询 Recall@3 仅 0.14），因此加一个**显式可解释**的意图加权。
 */
const OVERVIEW_INTENT = /整体|概览|总结|全貌|系统地讲|有哪些考|知识体系/gi
/** 命中概览意图时给概览块的加分（0.15 足以进入 top-3，又不至于压过明确的问题块） */
export const OVERVIEW_INTENT_BONUS = 0.15

function hasOverviewIntent(query: string): boolean {
  OVERVIEW_INTENT.lastIndex = 0
  return OVERVIEW_INTENT.test(query)
}

export interface RagIndex {
  chunks: RagChunk[]
  vectors: Float32Array[]
  /** 预分词的关键词集合：模块级算一次，避免每次检索都重新分词（性能护栏 <5ms） */
  keywordTokens: Set<string>[]
  provider: EmbeddingProvider
  manifest: RagVectorsManifest
}

/**
 * 解码产物并做 id 一一对应校验；任何不一致都返回 null（触发 L3 降级）。
 * @param sources 仅测试用：注入被破坏的产物以验证降级分支（混沌演练 D-1/D-2）
 */
export function loadIndex(sources?: {
  chunks?: unknown
  vectors?: unknown
}): RagIndex | null {
  try {
    const manifest = (sources?.vectors ?? vectorsJson) as RagVectorsManifest
    const chunks = (sources?.chunks ?? chunksJson) as RagChunk[]
    if (!manifest?.vectors || !manifest?.ids || !Array.isArray(chunks)) return null
    if (chunks.length !== manifest.ids.length) return null
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].id !== manifest.ids[i]) return null
    }
    if (manifest.idf.length !== manifest.dim) return null
    const quantized = new Int8Array(base64ToBytes(manifest.vectors))
    const vectors = decodeVectors(quantized, manifest.ids.length, manifest.dim)
    if (manifest.scale !== QUANT_SCALE) return null
    return {
      chunks,
      vectors,
      keywordTokens: chunks.map(chunk => new Set(tokenize(chunk.text))),
      provider: createEmbeddingProvider({ dim: manifest.dim, idf: manifest.idf }),
      manifest,
    }
  } catch {
    return null
  }
}

let cached: RagIndex | null | undefined

/** 模块级单例缓存；测试可用 __resetIndexCache 清理 */
export function getIndex(): RagIndex | null {
  if (cached === undefined) cached = loadIndex()
  return cached
}

export function __resetIndexCache(): void {
  cached = undefined
}

/** 检索是否不可用（L3 降级观测口径） */
export function isRagUnavailable(): boolean {
  return getIndex() === null
}

/** 关键词通道：Jaccard 相似度（块级 token 集合已在索引加载时算好） */
function keywordScore(queryTokens: Set<string>, chunkTokens: Set<string>): number {
  if (queryTokens.size === 0 || chunkTokens.size === 0) return 0
  return jaccardSimilarity(queryTokens, chunkTokens)
}

/**
 * 混合召回：0.7 × 余弦 + 0.3 × 关键词（权重可配）。
 * 全部低于 floor 时返回空数组 —— 这是「不注入空上下文」的第一道闸门。
 */
export function retrieve(query: string, options: RetrieveOptions = {}): RetrievedChunk[] {
  const {
    topK = DEFAULT_TOP_K,
    floor = 0,
    keywordWeight = DEFAULT_KEYWORD_WEIGHT,
    tagHint,
  } = options

  const index = getIndex()
  if (!index) return []
  const trimmed = query.trim()
  if (!trimmed) return []

  const queryVector = index.provider.embed(trimmed)
  const queryTokens = new Set(tokenize(trimmed))
  const hintSet = tagHint?.length ? new Set(tagHint) : null
  const overviewIntent = hasOverviewIntent(trimmed)
  const results: RetrievedChunk[] = []

  for (let i = 0; i < index.chunks.length; i++) {
    const chunk = index.chunks[i]
    if (hintSet && !chunk.tags.some(tag => hintSet.has(tag))) continue
    const cosine = cosineDot(queryVector, index.vectors[i])
    const keyword = keywordScore(queryTokens, index.keywordTokens[i])
    let score = (1 - keywordWeight) * cosine + keywordWeight * keyword
    if (overviewIntent && chunk.kind === 'tag-overview') score += OVERVIEW_INTENT_BONUS
    if (score >= floor) results.push({ chunk, score, cosine, keyword })
  }

  results.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
  return results.slice(0, topK)
}
