/**
 * vectorStore — 向量量化、编解码与相似度检索（纯函数，浏览器与 Node 双端可用）
 *
 * 量化口径（S2-R1 的核心约束）：
 * 阈值调优脚本与线上跑批**必须复用同一份 int8 量化向量**，
 * 否则「阈值脚本算出的通过率」与「线上实际通过率」会出现 >2pt 的偏差，
 * 阈值就失去意义。因此 decodeVectors 是唯一入口，两边都走它。
 *
 * 量化方式：全局 scale（所有向量共用一个缩放系数）+ 每维 int8。
 * 单位向量各维分量都在 [-1, 1]，用 scale = 127 即可把 int8 的
 * 量化误差控制在 1/127 ≈ 0.8% 以内，对**排序**无影响。
 */

/** base64 → Uint8Array：atob 优先（浏览器），Buffer 兜底（Node 脚本） */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  const buffer = (globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } }).Buffer
  if (!buffer) throw new Error('当前环境既没有 atob 也没有 Buffer，无法解码 base64')
  return new Uint8Array(buffer.from(base64, 'base64'))
}

/** Uint8Array → base64：btoa 优先，Buffer 兜底 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    // 分片避免超长字符串触发栈溢出
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  }
  const buffer = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer
  if (!buffer) throw new Error('当前环境既没有 btoa 也没有 Buffer，无法编码 base64')
  return buffer.from(bytes).toString('base64')
}

/** int8 量化步长：单位向量的分量范围是 [-1, 1] */
export const QUANT_SCALE = 127

/** Float32 矩阵 → int8 量化矩阵（就地写入，避免额外分配） */
export function encodeVectors(vectors: readonly Float32Array[]): Int8Array {
  const dim = vectors[0]?.length ?? 0
  const out = new Int8Array(vectors.length * dim)
  for (let v = 0; v < vectors.length; v++) {
    for (let d = 0; d < dim; d++) {
      const raw = vectors[v][d] * QUANT_SCALE
      // clamp 到 int8 边界，-128 保留给量化溢出
      const q = Math.max(-127, Math.min(127, Math.round(raw)))
      out[v * dim + d] = q
    }
  }
  return out
}

/** int8 量化矩阵 → Float32 矩阵（并按需做 L2 归一化，抵消量化误差） */
export function decodeVectors(quantized: Int8Array, count: number, dim: number): Float32Array[] {
  if (quantized.length !== count * dim) {
    throw new Error(`量化数据长度不匹配：${quantized.length} ≠ ${count} × ${dim}`)
  }
  const out: Float32Array[] = new Array(count)
  for (let v = 0; v < count; v++) {
    const vector = new Float32Array(dim)
    for (let d = 0; d < dim; d++) vector[d] = quantized[v * dim + d] / QUANT_SCALE
    out[v] = normalizeL2(vector)
  }
  return out
}

export function normalizeL2(vector: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i]
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= norm
  }
  return vector
}

/** 预归一化后的点积 = 余弦相似度 */
export function cosineDot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`维度不匹配：${a.length} ≠ ${b.length}`)
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

export interface ScoredIndex {
  index: number
  score: number
}

/** topK 余弦检索；按分数**降序**返回（分数相同的按索引升序，保证结果稳定可复现） */
export function topK(
  query: Float32Array,
  vectors: readonly Float32Array[],
  k: number,
): ScoredIndex[] {
  const scored: ScoredIndex[] = []
  for (let i = 0; i < vectors.length; i++) {
    scored.push({ index: i, score: cosineDot(query, vectors[i]) })
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.slice(0, Math.max(0, k))
}
