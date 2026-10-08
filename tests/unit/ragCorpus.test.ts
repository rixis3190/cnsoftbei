/**
 * ragCorpus 单测（S2-7）
 * 关注：块数区间、标签归一化（无中文泄漏）、长文切分、概览块只在 ≥3 题时生成。
 */

import { describe, it, expect } from 'vitest'
import { questions as pythonQuestions } from '../../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../../src/data/databaseQuestionBank'
import {
  buildCorpus,
  buildQuestionText,
  MAX_CHUNK_CHARS,
  MIN_TAG_OVERVIEW_QUESTIONS,
  splitLongText,
} from '../../src/rag/corpusBuilder'
import { normalizeTags } from '../../src/data/tagMap'
import type { PracticeQuestion } from '../../src/types'

const BANKS = [
  { bank: 'python' as const, questions: pythonQuestions },
  { bank: 'java' as const, questions: javaQuestions },
  { bank: 'database' as const, questions: databaseQuestions },
]

const { chunks, skipped } = buildCorpus(BANKS)

/** 用最小题集构造一条自定义题目 */
function makeQuestion(overrides: Partial<PracticeQuestion>): PracticeQuestion {
  return {
    id: 'x1',
    moduleId: 'module-1',
    type: 'short',
    difficulty: 'easy',
    category: 'core',
    tags: ['syntax'],
    question: '题干',
    ...overrides,
  }
}

describe('buildCorpus 规模与结构', () => {
  it('块数落在预期区间', () => {
    expect(chunks.length).toBeGreaterThanOrEqual(350)
    expect(chunks.length).toBeLessThanOrEqual(700)
  })

  it('无跳过项（题库字段完整）', () => {
    expect(skipped).toEqual([])
  })

  it('每题至少一个块，且块 id 唯一', () => {
    const questionChunks = chunks.filter(c => c.kind === 'question' && c.partIndex === 0)
    const ids = new Set(questionChunks.map(c => c.id))
    expect(ids.size).toBe(questionChunks.length)
    for (const q of [...pythonQuestions, ...javaQuestions, ...databaseQuestions]) {
      expect(questionChunks.some(c => c.sourceQuestionId === q.id)).toBe(true)
    }
  })

  it('标签全部已归一化，不含原始中文标签', () => {
    for (const chunk of chunks) {
      expect(chunk.tags.length).toBeGreaterThan(0)
      for (const tag of chunk.tags) {
        expect(tag).toMatch(/^[a-z]+-[a-z0-9-]+$/)
        expect(/[一-龥]/.test(tag)).toBe(false)
      }
    }
  })

  it('概览块只在题数 ≥3 的标签上生成', () => {
    // 统计每个归一化标签下的题数
    const perTag = new Map<string, number>()
    for (const { bank, questions } of BANKS) {
      for (const q of questions) {
        for (const tag of normalizeTags(bank, q.tags)) {
          perTag.set(tag, (perTag.get(tag) ?? 0) + 1)
        }
      }
    }
    const overview = chunks.filter(c => c.kind === 'tag-overview')
    expect(overview.length).toBeGreaterThan(0)
    for (const chunk of overview) {
      expect(perTag.get(chunk.tags[0]) ?? 0).toBeGreaterThanOrEqual(MIN_TAG_OVERVIEW_QUESTIONS)
    }
    // 题数不足 3 的标签不应生成概览块
    const rareTag = [...perTag.entries()].find(([, count]) => count < MIN_TAG_OVERVIEW_QUESTIONS)
    if (rareTag) expect(overview.some(c => c.tags[0] === rareTag[0])).toBe(false)
  })

  it('块正文长度不超过上限', () => {
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS * 1.5)
    }
  })
})

describe('buildQuestionText', () => {
  it('拼接题干、答案与解析', () => {
    const text = buildQuestionText(
      makeQuestion({ question: '什么是索引？', sampleAnswer: '加速查询的数据结构', explanation: 'B+ 树实现' }),
    )
    expect(text).toContain('什么是索引？')
    expect(text).toContain('答案：加速查询的数据结构')
    expect(text).toContain('解析：B+ 树实现')
  })

  it('判断题给出正确/错误', () => {
    expect(buildQuestionText(makeQuestion({ type: 'truefalse', trueFalseAnswer: false }))).toContain('答案：错误')
    expect(buildQuestionText(makeQuestion({ type: 'truefalse', trueFalseAnswer: true }))).toContain('答案：正确')
  })
})

describe('splitLongText', () => {
  it('不超过上限时返回 null', () => {
    expect(splitLongText('短文本。')).toBeNull()
  })

  it('超长文本被切成多段且相邻段有重叠', () => {
    const sentence = '这是一个用于测试切分逻辑的中文句子。'
    const long = sentence.repeat(60)
    const segments = splitLongText(long, 200)
    expect(segments).not.toBeNull()
    expect(segments!.length).toBeGreaterThan(1)
    // 末段应包含最后一句
    expect(segments![segments!.length - 1]).toContain('中文句子')

    // 重叠必须是「上一段的最后一句出现在下一段开头」，而不是整句重复
    const sentenceList = long.split(/(?<=[。！？])/).filter(s => s.trim().length > 0)
    for (let i = 1; i < segments!.length; i++) {
      const prevLast = segments![i - 1]
        .split(/(?<=[。！？])/)
        .filter(s => s.trim().length > 0)
        .pop()!
      expect(segments![i].startsWith(prevLast)).toBe(true)
    }
    expect(sentenceList.length).toBeGreaterThan(segments!.length)
  })

  it('不重复句子（旧实现会产出重复段的负向验证）', () => {
    // 用短 maxChars 逼出多段，逐段检查「同一句不在段内连续出现两次」
    const text = 'AAA。BBB。CCC。DDD。EEE。FFF。'
    const segments = splitLongText(text, 12)
    expect(segments).not.toBeNull()
    for (const segment of segments!) {
      const parts = segment.split(/(?<=[。！？])/).filter(s => s.trim().length > 0)
      for (let i = 1; i < parts.length; i++) {
        expect(parts[i]).not.toBe(parts[i - 1])
      }
    }
  })

  it('无法切分（只有一句超长）时返回 null', () => {
    expect(splitLongText('长'.repeat(800), 200)).toBeNull()
  })
})

describe('概览块超长时的显式截断（不允许静默丢数据）', () => {
  it('超过 MAX_CHUNK_CHARS 时保留前 N 字并追加省略标记', () => {
    // 造 20 道同标签、题干很长的题，逼概览块超限
    const longQuestions = Array.from({ length: 20 }, (_, i) => ({
      id: `syn-${i}`,
      moduleId: 'module-1',
      type: 'short' as const,
      difficulty: 'medium' as const,
      category: 'core' as const,
      tags: ['syntax'],
      question: `第${i}题的题干写得非常长，用来把概览块撑过上限。${'补充说明文字。'.repeat(6)}`,
      sampleAnswer: '参考答案',
      explanation: '解析',
    }))

    const { chunks } = buildCorpus([{ bank: 'python', questions: longQuestions }])
    const overview = chunks.find(c => c.kind === 'tag-overview')
    expect(overview).toBeDefined()
    expect(overview!.text.length).toBeGreaterThan(MAX_CHUNK_CHARS)
    expect(overview!.text.endsWith('…（其余条目已省略）')).toBe(true)

    // 负向：未超限时不应出现标记
    const shortQuestions = longQuestions.slice(0, 3)
    const { chunks: smallChunks } = buildCorpus([{ bank: 'python', questions: shortQuestions }])
    const smallOverview = smallChunks.find(c => c.kind === 'tag-overview')
    expect(smallOverview!.text.includes('已省略')).toBe(false)
  })
})

describe('异常数据', () => {
  it('空题干的题目被跳过并记录原因', () => {
    const result = buildCorpus([
      { bank: 'python', questions: [makeQuestion({ id: 'bad1', question: '  ', sampleAnswer: '' })] },
    ])
    expect(result.chunks).toHaveLength(0)
    expect(result.skipped).toEqual([{ bank: 'python', questionId: 'bad1', reason: '题干与答案均为空' }])
  })

  it('标签为空的题目被跳过并记录原因', () => {
    const result = buildCorpus([{ bank: 'java', questions: [makeQuestion({ id: 'bad2', tags: [] })] }])
    expect(result.chunks).toHaveLength(0)
    expect(result.skipped[0].reason).toBe('标签归一化后为空')
  })
})
