/**
 * embeddingProvider — 确定性文本向量化（特征哈希 + 亚线性 tf × IDF）
 *
 * 为什么不用模型嵌入（如 bge-small-zh）：
 * - 铁律 1「可复现优先于效果」：模型嵌入需要权重文件与推理环境，
 *   构建期与运行期很难位级一致，阈值会漂移；
 * - 特征哈希的**同输入永远同输出**是本文所有可复现性断言的基础。
 * 代价是语义泛化能力弱（近义改写匹配不到），这一点在报告里必须如实写明。
 *
 * 关键设计（T-2）：**IDF 由调用方注入**。
 * IDF 依赖语料统计，若运行期重算就会与构建期不一致 → 阈值口径失真。
 * 因此 idf 随产物落盘（ragVectors.json），这里只消费不计算。
 *
 * 已知取舍：dim 默认 256（受首屏体积约束），而 hash 桶会把不同词折叠到同一维，
 * 因此**桶级 IDF 接近 1.0、几乎没有区分度**。检索区分度主要来自
 * 中文 1/2/3-gram 特征与余弦相似度本身。构建报告会打印 idf 分布来暴露这一点，
 * 不做「IDF 很有用」的虚假宣传。
 */

import { STOP_WORDS } from '../services/tutorQuality'

export interface EmbeddingProvider {
  /** 向量维度 */
  readonly dim: number
  /** 单条文本 → 单位向量 */
  embed(text: string): Float32Array
  /** 批量文本 → 单位向量 */
  embedBatch(texts: readonly string[]): Float32Array[]
}

export interface EmbeddingProviderOptions {
  dim: number
  /** 与 dim 等长；由 scripts/build-vectors.ts 在构建期算出并落盘 */
  idf: readonly number[]
}

/** FNV-1a 32 位哈希（固定实现，跨环境位级一致） */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    // hash *= 16777619，用位运算避免浮点差异
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash >>> 0
}

const ASCII_ONLY = /^[a-z0-9]+$/i
const MIN_ASCII_LENGTH = 2

/**
 * 文本 → 特征词表：
 * - 中文连续片段生成 1/2/3-gram（单字区分度低，靠 bigram/trigram 稳住语义）；
 * - 英文/数字按整词；
 * - 过滤停用词与单字符英文词。
 */
export function extractFeatures(text: string): string[] {
  const features: string[] = []
  // 按「连续中文」与「连续英文数字」切成片段
  const chunks = text.match(/[一-龥]+|[a-zA-Z0-9]+/g) ?? []
  for (const chunk of chunks) {
    if (ASCII_ONLY.test(chunk)) {
      const lower = chunk.toLowerCase()
      if (lower.length < MIN_ASCII_LENGTH) continue
      if (STOP_WORDS.has(lower)) continue
      features.push(lower)
      continue
    }
    const chars = [...chunk]
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= chars.length; i++) {
        const gram = chars.slice(i, i + n).join('')
        if (STOP_WORDS.has(gram)) continue
        features.push(gram)
      }
    }
  }
  return features
}

/** 词频（Map 保证遍历顺序稳定：按插入序，与文本顺序一致） */
function termCounts(features: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const feature of features) counts.set(feature, (counts.get(feature) ?? 0) + 1)
  return counts
}

export function createEmbeddingProvider(options: EmbeddingProviderOptions): EmbeddingProvider {
  const { dim, idf } = options
  if (!Number.isInteger(dim) || dim <= 0) throw new Error(`非法 dim：${dim}`)
  if (idf.length !== dim) throw new Error(`idf 长度必须与 dim 一致：${idf.length} ≠ ${dim}`)

  const embed = (text: string): Float32Array => {
    const vector = new Float32Array(dim)
    const counts = termCounts(extractFeatures(text))
    if (counts.size === 0) return vector
    for (const [feature, count] of counts) {
      const bucket = fnv1a(feature) % dim
      // 亚线性 tf：出现 10 次不等于重要 10 倍
      const sublinearTf = 1 + Math.log(count)
      vector[bucket] += sublinearTf * (idf[bucket] ?? 1)
    }
    // L2 归一化：归一化后余弦相似度 = 点积
    let norm = 0
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i]
    norm = Math.sqrt(norm)
    if (norm > 0) {
      for (let i = 0; i < dim; i++) vector[i] /= norm
    }
    return vector
  }

  return {
    dim,
    embed,
    embedBatch(texts: readonly string[]) {
      return texts.map(embed)
    },
  }
}
