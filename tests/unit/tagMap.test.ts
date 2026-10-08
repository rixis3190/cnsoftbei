/**
 * tagMap 单测：三个题库共用一套标签命名空间
 */

import { describe, it, expect } from 'vitest'
import { normalizeTag, normalizeTags, tagLabel } from '../../src/data/tagMap'
import { questions as pythonQuestions } from '../../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../../src/data/databaseQuestionBank'

describe('normalizeTag', () => {
  it('python 与 java 的同名标签不会撞车', () => {
    expect(normalizeTag('python', 'syntax')).toBe('python-syntax')
    expect(normalizeTag('java', 'syntax')).toBe('java-syntax')
  })

  it('database 的中文标签映射为 ASCII slug', () => {
    expect(normalizeTag('database', 'SQL基础')).toBe('database-sql-basics')
    expect(normalizeTag('database', '数据库基础')).toBe('database-fundamentals')
    expect(normalizeTag('database', '数据库运维')).toBe('database-ops')
  })

  it('结果恒为小写 ASCII slug', () => {
    expect(normalizeTag('python', 'OOP')).toBe('python-oop')
    expect(normalizeTag('java', 'errorProne')).toBe('java-errorprone')
  })

  it('空标签返回空串', () => {
    expect(normalizeTag('python', '   ')).toBe('')
  })

  it('未映射的中文标签退化为稳定哈希 slug（不丢数据也不泄漏中文）', () => {
    const first = normalizeTag('database', '未知标签')
    expect(first).toMatch(/^database-tag-[0-9a-f]+$/)
    expect(normalizeTag('database', '未知标签')).toBe(first)
  })
})

describe('normalizeTags', () => {
  it('去重且保持顺序', () => {
    expect(normalizeTags('java', ['syntax', 'data-types', 'syntax'])).toEqual([
      'java-syntax',
      'java-data-types',
    ])
  })

  it('三个题库全量归一化后无中文、无空值', () => {
    const banks = [
      { bank: 'python' as const, questions: pythonQuestions },
      { bank: 'java' as const, questions: javaQuestions },
      { bank: 'database' as const, questions: databaseQuestions },
    ]
    const all = new Set<string>()
    for (const { bank, questions } of banks) {
      for (const q of questions) {
        const tags = normalizeTags(bank, q.tags)
        expect(tags.length).toBeGreaterThan(0)
        for (const tag of tags) {
          expect(/^[a-z]+-[a-z0-9-]+$/.test(tag)).toBe(true)
          all.add(tag)
        }
      }
    }
    // 归一化后应有 40+ 个标签（17 python + 19 java + 9 database，去重后）
    expect(all.size).toBeGreaterThanOrEqual(40)
  })
})

describe('tagLabel', () => {
  it('已知 slug 返回中文名', () => {
    expect(tagLabel('database-sql-basics')).toBe('SQL 基础')
    expect(tagLabel('java-io')).toBe('IO 流')
  })

  it('未知 slug 回退为 slug 本身', () => {
    expect(tagLabel('python-syntax')).toBe('syntax')
  })
})
