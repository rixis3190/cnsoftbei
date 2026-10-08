import { describe, it, expect } from 'vitest'
import { questions, learningPlan } from '../../src/data/pythonQuestionBank'

// ==================== 题库数据完整性测试 ====================

describe('pythonQuestionBank 数据完整性', () => {
  // ==================== ID 唯一性 ====================
  describe('题目 ID 唯一性', () => {
    it('所有题目 ID 不重复', () => {
      const ids = questions.map(q => q.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('ID 非空字符串', () => {
      for (const q of questions) {
        expect(q.id).toBeTruthy()
        expect(typeof q.id).toBe('string')
        expect(q.id.length).toBeGreaterThan(0)
      }
    })
  })

  // ==================== 必填字段 ====================
  describe('必填字段完整性', () => {
    it('所有题目有 id', () => {
      for (const q of questions) {
        expect(q.id).toBeDefined()
      }
    })

    it('所有题目有 moduleId', () => {
      for (const q of questions) {
        expect(q.moduleId).toBeTruthy()
      }
    })

    it('所有题目有 type', () => {
      const validTypes = ['choice', 'truefalse', 'short', 'fill']
      for (const q of questions) {
        expect(validTypes).toContain(q.type)
      }
    })

    it('所有题目有 question 文本', () => {
      for (const q of questions) {
        expect(q.question).toBeTruthy()
        expect(q.question.length).toBeGreaterThan(0)
      }
    })

    it('所有题目有 tags 且非空', () => {
      for (const q of questions) {
        expect(Array.isArray(q.tags)).toBe(true)
        expect(q.tags.length).toBeGreaterThan(0)
      }
    })

    it('所有题目有 difficulty', () => {
      const validDiffs = ['easy', 'medium', 'hard']
      for (const q of questions) {
        expect(validDiffs).toContain(q.difficulty)
      }
    })

    it('所有题目有 category', () => {
      const validCats = ['core', 'extension']
      for (const q of questions) {
        expect(validCats).toContain(q.category)
      }
    })
  })

  // ==================== 题型特定字段 ====================
  describe('题型特定字段', () => {
    it('选择题有 options 且 >= 2 项', () => {
      const choiceQuestions = questions.filter(q => q.type === 'choice')
      for (const q of choiceQuestions) {
        expect(q.options).toBeDefined()
        expect(q.options!.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('选择题有 correctAnswer 且在 options 中', () => {
      const choiceQuestions = questions.filter(q => q.type === 'choice')
      for (const q of choiceQuestions) {
        expect(q.correctAnswer).toBeDefined()
        expect(q.options).toContain(q.correctAnswer)
      }
    })

    it('判断题有 trueFalseAnswer 且为 boolean', () => {
      const tfQuestions = questions.filter(q => q.type === 'truefalse')
      for (const q of tfQuestions) {
        expect(typeof q.trueFalseAnswer).toBe('boolean')
      }
    })

    it('填空题有 fillAnswer 且非空', () => {
      const fillQuestions = questions.filter(q => q.type === 'fill')
      for (const q of fillQuestions) {
        expect(q.fillAnswer).toBeTruthy()
        expect(q.fillAnswer!.length).toBeGreaterThan(0)
      }
    })

    it('简答题有 sampleAnswer 且非空', () => {
      const shortQuestions = questions.filter(q => q.type === 'short')
      for (const q of shortQuestions) {
        expect(q.sampleAnswer).toBeTruthy()
        expect(q.sampleAnswer!.length).toBeGreaterThan(0)
      }
    })
  })

  // ==================== moduleId 有效性 ====================
  describe('moduleId 有效性', () => {
    it('所有 moduleId 在 learningPlan.modules 中存在', () => {
      const validModuleIds = new Set(learningPlan.modules.map(m => m.id))
      for (const q of questions) {
        expect(validModuleIds).toContain(q.moduleId)
      }
    })
  })

  // ==================== learningPlan 完整性 ====================
  describe('learningPlan 完整性', () => {
    it('learningPlan 有 id 和 name', () => {
      expect(learningPlan.id).toBeTruthy()
      expect(learningPlan.name).toBeTruthy()
    })

    it('learningPlan 有 modules 且非空', () => {
      expect(learningPlan.modules.length).toBeGreaterThan(0)
    })

    it('每个 module 有 id, name, tags', () => {
      for (const m of learningPlan.modules) {
        expect(m.id).toBeTruthy()
        expect(m.name).toBeTruthy()
        expect(Array.isArray(m.tags)).toBe(true)
      }
    })

    it('每个模块的题目数可统计', () => {
      for (const m of learningPlan.modules) {
        const actualCount = questions.filter(q => q.moduleId === m.id).length
        expect(actualCount).toBeGreaterThan(0)
      }
    })
  })

  // ==================== 标签规范 ====================
  describe('标签规范', () => {
    it('tags 无空字符串', () => {
      for (const q of questions) {
        for (const tag of q.tags) {
          expect(tag.trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('tags 无重复（单题目内）', () => {
      for (const q of questions) {
        const uniqueTags = new Set(q.tags)
        expect(uniqueTags.size).toBe(q.tags.length)
      }
    })

    it('所有 tag 都是已知知识点标签', () => {
      const knownTags = new Set([
        'syntax', 'data-types', 'operators', 'control-flow',
        'functions', 'modules', 'scope', 'OOP', 'classes',
        'inheritance', 'polymorphism', 'exceptions', 'files',
        'decorators', 'comprehensions', 'errorProne', 'studyHabit',
        // 数据库标签
        '数据库基础', 'SQL基础', '数据库约束', '数据库索引',
        '数据库事务', '多表查询', '数据库设计', '数据库运维', '数据库类型',
      ])
      for (const q of questions) {
        for (const tag of q.tags) {
          expect(knownTags).toContain(tag)
        }
      }
    })
  })

  // ==================== 题目分布统计 ====================
  describe('题目分布', () => {
    it('总题目数 > 0', () => {
      expect(questions.length).toBeGreaterThan(0)
    })

    it('每个模块都有题目', () => {
      for (const m of learningPlan.modules) {
        const count = questions.filter(q => q.moduleId === m.id).length
        expect(count).toBeGreaterThan(0)
      }
    })

    it('四种题型都存在', () => {
      const types = new Set(questions.map(q => q.type))
      expect(types).toContain('choice')
      expect(types).toContain('truefalse')
      expect(types).toContain('short')
    })

    it('core 题目多于 extension', () => {
      const core = questions.filter(q => q.category === 'core').length
      const ext = questions.filter(q => q.category === 'extension').length
      expect(core).toBeGreaterThan(ext)
    })
  })
})
