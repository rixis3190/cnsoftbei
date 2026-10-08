/**
 * retriever — 面向用户的检索入口（计划 S4-1）
 *
 * 与 buildIndex 的 `retrieve` 的区别：这一层负责**开关与降级**，
 * 业务代码只调 `retrieveForQuestion`，不直接碰索引。
 *
 * 三条硬约束：
 * 1. `RAG_ENABLED=false` → 直接返回 `[]`（不加载索引、不做任何计算）；
 * 2. 检索失败（索引缺失/解码失败）→ 返回 `[]` 并标记 `ragUnavailable`，
 *    **绝不抛给 UI，也绝不注入空上下文**（降级链 L3）；
 * 3. tag 命中情况写入 metadata，便于报告归因「答不准是不是检索没召回」。
 */

import { EVAL_SWITCHES } from '../config/evalConfig'
import { RETRIEVAL_FLOOR } from '../config/qualityThresholds'
import { isRagUnavailable, retrieve, type RetrievedChunk } from './buildIndex'

export interface RetrieveForQuestionOptions {
  topK?: number
  /** 归一化标签提示；为空则不做 tag 前置过滤 */
  tagHint?: readonly string[]
  /** 覆盖全局 floor（主要用于实验，不传则用固化阈值） */
  floor?: number
  /** 覆盖全局开关（单测用） */
  enabled?: boolean
}

export interface RetrieveForQuestionResult {
  chunks: RetrievedChunk[]
  /** 检索不可用（L3 降级），报告里要能看到 */
  ragUnavailable: boolean
  /** 命中的标签（归因用） */
  matchedTags: string[]
  /** 有效分数上限；无结果时为 0 */
  topScore: number
}

export function retrieveForQuestion(
  question: string,
  options: RetrieveForQuestionOptions = {},
): RetrieveForQuestionResult {
  const enabled = options.enabled ?? EVAL_SWITCHES.RAG_ENABLED
  if (!enabled) {
    return { chunks: [], ragUnavailable: false, matchedTags: [], topScore: 0 }
  }

  const floor = options.floor ?? RETRIEVAL_FLOOR
  try {
    const chunks = retrieve(question, {
      topK: options.topK ?? 3,
      floor,
      tagHint: options.tagHint ? [...options.tagHint] : undefined,
    })
    const matchedTags = [...new Set(chunks.flatMap(hit => hit.chunk.tags))]
    return {
      chunks,
      ragUnavailable: isRagUnavailable(),
      matchedTags,
      topScore: chunks.length > 0 ? chunks[0].score : 0,
    }
  } catch (error) {
    // L3：检索异常一律吞掉，退化为「无检索结果」
    console.warn('[RAG] 检索异常，降级为不注入上下文', error)
    return { chunks: [], ragUnavailable: true, matchedTags: [], topScore: 0 }
  }
}

// 注：曾有一个 describeMatchedTags(tags) 把标签列表转成中文串，
// 但引用标注已由 ragPrompts.formatCitations 负责（它对 FormattedChunk 起作用），
// 该函数没有生产调用方，故删除（评审：死代码清理）。

