/**
 * corpusBuilder — 题库 → RAG 语料块（纯函数，无 IO）
 *
 * 分块策略（计划 S2-3）：
 * - 一题一 chunk：题干 + 正确答案/参考答案 + 解析，是检索的主要命中面；
 * - tag 概览块：同一标签下 ≥3 题时额外生成一个「知识点概览」块，
 *   覆盖「XX 是什么/有哪些」这类概览型提问（单题块答不了）；
 * - 超长文本（>600 字）按中文句号切 2 段、重叠 1 句，子块带 partIndex。
 *
 * 标签一律走 normalizeTags 归一化，因此产物里不会出现原始中文标签。
 */

import { bankLabel, normalizeTags, tagLabel, type QuestionBank } from '../data/tagMap'
import type { PracticeQuestion, QuestionType } from '../types'

export type ChunkKind = 'question' | 'tag-overview'

export interface RagChunk {
  id: string
  kind: ChunkKind
  bank: QuestionBank
  /** 归一化标签 */
  tags: string[]
  /** chunk 正文（供向量化与提示词注入） */
  text: string
  /** 来源题号；tag-overview 块为 null */
  sourceQuestionId: string | null
  /** 长文本子块序号，0 表示未切分 */
  partIndex: number
  moduleId: string
  type: QuestionType | 'overview'
  difficulty: string
}

/** 单个 chunk 的正文长度上限，超过则切分 */
export const MAX_CHUNK_CHARS = 600
/** 生成 tag 概览块所需的最小题数 */
export const MIN_TAG_OVERVIEW_QUESTIONS = 3

function answerOf(q: PracticeQuestion): string {
  if (q.sampleAnswer) return q.sampleAnswer
  if (q.type === 'truefalse') return q.trueFalseAnswer ? '正确' : '错误'
  if (q.type === 'fill') return q.fillAnswer ?? ''
  return q.correctAnswer ?? ''
}

/** 题干 + 答案 + 解析拼成检索正文 */
export function buildQuestionText(q: PracticeQuestion): string {
  const parts = [q.question.trim()]
  const answer = answerOf(q).trim()
  if (answer) parts.push(`答案：${answer}`)
  if (q.explanation?.trim()) parts.push(`解析：${q.explanation.trim()}`)
  return parts.join('\n')
}

/** 按中文句号切段，overlap 句重叠；不切分时返回 null */
export function splitLongText(text: string, maxChars = MAX_CHUNK_CHARS): string[] | null {
  if (text.length <= maxChars) return null
  const sentences = text.split(/(?<=[。！？])/).filter(s => s.trim().length > 0)
  if (sentences.length < 2) return null

  const segments: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + sentence).length > maxChars) {
      segments.push(current)
      // 重叠：把**刚结束那一段的最后一句**带进新段的开头，避免答案被切在边界上。
      // 注意别把 carry 再叠加到 current 上 —— 那样会把同一句写两遍
      // （旧实现会产出 "D。D。E。" 这种重复段，已修复）。
      const prevSentences = current.split(/(?<=[。！？])/).filter(s => s.trim().length > 0)
      const carry = prevSentences[prevSentences.length - 1] ?? ''
      current = carry && carry.length + sentence.length <= maxChars ? carry + sentence : sentence
    } else {
      current += sentence
    }
  }
  if (current) segments.push(current)
  return segments.length > 1 ? segments : null
}

/**
 * 概览块正文：超长时保留第一段并显式标注省略。
 * 之前用 `splitLongText(text)?.[0] ?? text`，超出上限的那部分会被**静默丢掉**，
 * 既没有截断标记也不进 skipped 清单；一旦某标签题数变多，检索内容会无痕减少。
 */
function buildOverviewText(text: string, maxChunkChars: number): string {
  if (text.length <= maxChunkChars) return text
  return `${text.slice(0, maxChunkChars)}…（其余条目已省略）`
}

/** 归一化题库输入：只保留检索需要的字段 */
export function buildCorpus(banks: readonly { bank: QuestionBank; questions: readonly PracticeQuestion[] }[]): {
  chunks: RagChunk[]
  skipped: { bank: QuestionBank; questionId: string; reason: string }[]
} {
  const chunks: RagChunk[] = []
  const skipped: { bank: QuestionBank; questionId: string; reason: string }[] = []
  const tagBuckets = new Map<string, { bank: QuestionBank; tag: string; questions: PracticeQuestion[] }>()

  for (const { bank, questions } of banks) {
    for (const q of questions) {
      const tags = normalizeTags(bank, q.tags)
      if (tags.length === 0) {
        skipped.push({ bank, questionId: q.id, reason: '标签归一化后为空' })
        continue
      }
      const text = buildQuestionText(q)
      if (!text.trim()) {
        skipped.push({ bank, questionId: q.id, reason: '题干与答案均为空' })
        continue
      }

      const segments = splitLongText(text)
      if (segments) {
        segments.forEach((segment, partIndex) => {
          chunks.push({
            id: `${bank}-${q.id}#p${partIndex}`,
            kind: 'question',
            bank,
            tags,
            text: segment,
            sourceQuestionId: q.id,
            partIndex,
            moduleId: q.moduleId,
            type: q.type,
            difficulty: q.difficulty,
          })
        })
      } else {
        chunks.push({
          id: `${bank}-${q.id}`,
          kind: 'question',
          bank,
          tags,
          text,
          sourceQuestionId: q.id,
          partIndex: 0,
          moduleId: q.moduleId,
          type: q.type,
          difficulty: q.difficulty,
        })
      }

      for (const tag of tags) {
        const key = `${bank}:${tag}`
        if (!tagBuckets.has(key)) tagBuckets.set(key, { bank, tag, questions: [] })
        tagBuckets.get(key)!.questions.push(q)
      }
    }
  }

  // tag 概览块：题数 ≥3 的标签才生成，避免为 1-2 题的标签造噪声块
  for (const { bank, tag, questions } of tagBuckets.values()) {
    if (questions.length < MIN_TAG_OVERVIEW_QUESTIONS) continue
    const sample = questions.slice(0, 12)
    // 概览块正文用**中文题库名 + 中文标签名**：用户提问是自然语言，
    // 若正文只写英文 slug（如 python-syntax），概览型查询几乎召回不到
    // （实测 Recall@3 仅 0.14）。
    const label = tagLabel(tag)
    const bankName = bankLabel(bank)
    const text = [
      `【知识点概览】${bankName} · ${label}`,
      `本主题共 ${questions.length} 道题，${bankName}${label}的典型考点包括：`,
      ...sample.map(q => `- ${q.question.trim()}`),
    ].join('\n')
    chunks.push({
      id: `overview-${bank}-${tag}`,
      kind: 'tag-overview',
      bank,
      tags: [tag],
      // 概览块超出上限时保留第一段并**显式标注省略**，
      // 不做静默丢弃（与「不允许静默丢数据」的口径一致）
      text: buildOverviewText(text, MAX_CHUNK_CHARS),
      sourceQuestionId: null,
      partIndex: 0,
      moduleId: questions[0].moduleId,
      type: 'overview',
      difficulty: 'mixed',
    })
  }

  return { chunks, skipped }
}
