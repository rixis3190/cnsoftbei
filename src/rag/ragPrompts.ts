/**
 * ragPrompts — 检索结果 → 提示词文本（计划 S4-2）
 *
 * 与 promptBuilder 的职责边界：本文件只管「片段怎么排版、怎么编号」，
 * promptBuilder 管「文本怎么进 messages」。两者不混在一起，便于分别测试。
 *
 * 长度上限是硬约束（S4-R5）：单片段 ≤300 字、总长 ≤1500 字。
 * 检索注入最容易出的问题是 prompt 膨胀导致回答啰嗦或超 max_tokens，
 * 因此超限时**按片段顺序截断**（保头保尾，中间用省略号），而不是简单丢尾。
 */

import type { RetrievedChunk } from './buildIndex'
import { tagLabel } from '../data/tagMap'

/** 单个片段注入长度上限 */
export const MAX_CHUNK_CHARS = 300
/** 所有片段注入总长度上限 */
export const MAX_TOTAL_CHARS = 1500
/** 注入片段数量上限（与单片段字数上限是**两个不同的量纲**，不要混用） */
export const MAX_CHUNKS = 3

export interface FormattedChunk {
  /** 引用编号，从 1 开始 */
  index: number
  text: string
  tags: string[]
  tagLabel: string
  /** 该片段是否被截断 */
  truncated: boolean
}

/**
 * 检索命中 → 带引用号的片段列表。
 * 空输入返回空数组（**不返回任何占位文本**，上层据此判定「不注入」）。
 */
export function formatChunksForPrompt(
  hits: readonly RetrievedChunk[],
  options: { maxChunkChars?: number; maxTotalChars?: number; maxChunks?: number } = {},
): FormattedChunk[] {
  const maxChunkChars = options.maxChunkChars ?? MAX_CHUNK_CHARS
  const maxTotalChars = options.maxTotalChars ?? MAX_TOTAL_CHARS
  const maxChunks = options.maxChunks ?? MAX_CHUNKS
  const out: FormattedChunk[] = []
  let used = 0

  for (const hit of hits) {
    // 用 maxChunks（片段个数）比较，不要用 maxChunkChars（字符数）——
    // 量纲混用会让这个守卫永远不触发
    if (out.length >= maxChunks) break
    const text = hit.chunk.text
    // 单片段截断：truncated 必须在截断分支里直接置位，
    // 用长度比较会漏报 text.length === maxChunkChars + 1 的边界
    const chunkTruncated = text.length > maxChunkChars
    let body = chunkTruncated ? `${text.slice(0, maxChunkChars)}…` : text
    let truncated = chunkTruncated

    // 总长预算：放不下就停止追加（不硬截，避免半句话）
    if (used + body.length > maxTotalChars) {
      const remaining = maxTotalChars - used
      if (remaining <= 40) break
      body = `${body.slice(0, remaining)}…`
      truncated = true
    }
    used += body.length

    out.push({
      index: out.length + 1,
      text: body,
      tags: hit.chunk.tags,
      tagLabel: hit.chunk.tags.map(tagLabel).join('/'),
      truncated,
    })
  }

  return out
}

/** 引用标注：给回答末尾附「依据 [1] 数据库事务」这样的可溯源列表 */
export function formatCitations(chunks: readonly FormattedChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map(c => `[${c.index}] ${c.tagLabel || c.tags.join('/')}`)
    .join('；')
}

