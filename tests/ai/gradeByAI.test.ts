import { describe, it, expect, vi, beforeEach } from 'vitest'

// ==================== Mock ====================
vi.mock('../../src/services/api', () => ({
  streamChatCompletion: vi.fn(),
}))

vi.mock('../../src/services/learningOrchestrator', () => ({
  appendLearningCycleLog: vi.fn((logs: any) => logs || []),
  buildLearningEvaluationReport: vi.fn(),
  syncLearningProfileFromPractice: vi.fn((p: any) => p),
  saveProfileAndNotify: vi.fn(),
  broadcastEvent: vi.fn(),
  SYSTEM_EVENTS: { PRACTICE_UPDATED: 'practiceStateUpdated' },
}))

vi.mock('../../src/data/mockData', () => ({
  initialProfile: {
    id: 'test', name: '测试', major: 'CS', grade: '大三', updatedAt: '',
    dimensions: [
      { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
      { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
      { key: 'errorProne', label: '易错点', value: '', level: '低' },
      { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
      { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
      { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
    ],
  },
}))

import { gradeByAI } from '../../src/services/practiceGrader'
import { streamChatCompletion } from '../../src/services/api'
import type { PracticeQuestion } from '../../src/types'

function makeShortQuestion(overrides: Partial<PracticeQuestion> = {}): PracticeQuestion {
  return {
    id: 'q-short-1',
    moduleId: 'module-1',
    type: 'short',
    difficulty: 'medium',
    category: 'core',
    tags: ['syntax'],
    question: '请解释 Python 中 == 和 is 的区别',
    sampleAnswer: '== 比较值，is 比较引用',
    ...overrides,
  }
}

// ==================== gradeByAI 防幻觉测试 ====================

describe('gradeByAI 防幻觉测试', () => {
  beforeEach(() => {
    vi.mocked(streamChatCompletion).mockReset()
  })

  // ---------- 标准响应 ----------
  describe('标准响应格式', () => {
    it('纯数字 "85" → 85', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('85', false); return '85' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(85)
    })

    it('"这个回答值得 75 分" → 75', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('这个回答值得 75 分', false); return '这个回答值得 75 分' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(75)
    })

    it('"回答不错，给出评分：92" → 92', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('回答不错，给出评分：92', false); return '回答不错，给出评分：92' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(92)
    })
  })

  // ---------- 边界值 ----------
  describe('边界值处理', () => {
    it('"150" → clamp 到 100', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('150', false); return '150' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(100)
    })

    it('"0" → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('0', false); return '0' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })

    it('"100" → 100', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('100', false); return '100' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(100)
    })

    it('"-5" → 提取 "5"（负号被忽略）', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('-5', false); return '-5' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(5)
    })

    it('"78.5" → parseInt 截断为 78', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('78.5', false); return '78.5' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(78)
    })
  })

  // ---------- 异常/幻觉响应 ----------
  describe('异常 AI 响应', () => {
    it('空响应 → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('', false); return '' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })

    it('纯文字无数字 → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('这个回答很差，不符合要求', false); return '这个回答很差，不符合要求' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })

    it('中文数字 "八十五分" → 0（无法提取）', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('八十五分', false); return '八十五分' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })

    it('多个数字 "有 3 个错误，得分 60" → 取最高分 60', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('有 3 个错误，得分 60', false); return '有 3 个错误，得分 60' }
      )
      // 改进行为：取最高分（过滤 0-100 范围后取 max）
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(60)
    })

    it('Markdown 包裹 "```85```" → 85', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('```85```', false); return '```85```' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(85)
    })

    it('AI 编造不存在的评分维度 — 仍提取数字', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => {
          const text = '根据我的创新评分体系，该答案在逻辑维度得 70 分，创意维度得 85 分，综合 72 分'
          onChunk?.(text, false)
          return text
        }
      )
      // 取最高分 85（70, 85, 72 中最大）
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(85)
    })

    it('AI 返回 "N/A" → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('N/A', false); return 'N/A' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })

    it('AI 返回 "score: NaN" → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => { onChunk?.('score: NaN', false); return 'score: NaN' }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })
  })

  // ---------- thinking 块隔离 ----------
  describe('thinking 块隔离', () => {
    it('thinking 内容不参与分数提取', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => {
          onChunk?.('[思考中...]', true)
          onChunk?.('让我分析一下这个答案...90...', true)  // thinking 中有数字
          onChunk?.('75', false)  // 正式输出
          return '75'
        }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(75)
    })

    it('只有 thinking 没有 text → 0', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (_m, onChunk) => {
          onChunk?.('[思考中...]', true)
          onChunk?.('思考 85 分', true)
          return ''
        }
      )
      expect(await gradeByAI(makeShortQuestion(), '答案')).toBe(0)
    })
  })

  // ---------- 非 short 题型 ----------
  describe('非 short 题型', () => {
    it('choice 题型 → 直接返回 0 不调用 API', async () => {
      const q = makeShortQuestion({ type: 'choice' })
      expect(await gradeByAI(q, 'B')).toBe(0)
      expect(streamChatCompletion).not.toHaveBeenCalled()
    })

    it('truefalse 题型 → 直接返回 0', async () => {
      const q = makeShortQuestion({ type: 'truefalse' })
      expect(await gradeByAI(q, 'true')).toBe(0)
    })

    it('fill 题型 → 直接返回 0', async () => {
      const q = makeShortQuestion({ type: 'fill' })
      expect(await gradeByAI(q, 'print')).toBe(0)
    })
  })

  // ---------- 网络异常 ----------
  describe('网络异常', () => {
    it('网络断开 — 异常传播', async () => {
      vi.mocked(streamChatCompletion).mockRejectedValue(new Error('Network error'))
      await expect(gradeByAI(makeShortQuestion(), '答案')).rejects.toThrow('Network error')
    })

    it('超时 — 异常传播', async () => {
      vi.mocked(streamChatCompletion).mockRejectedValue(new Error('timeout'))
      await expect(gradeByAI(makeShortQuestion(), '答案')).rejects.toThrow('timeout')
    })
  })

  // ---------- System Prompt 约束验证 ----------
  describe('System Prompt 约束', () => {
    it('system prompt 包含评分标准', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (msgs) => {
          const systemMsg = msgs.find((m: any) => m.role === 'system')
          expect(systemMsg?.content).toContain('0-100')
          expect(systemMsg?.content).toContain('评分标准')
          return '85'
        }
      )
      await gradeByAI(makeShortQuestion(), '答案')
    })

    it('user prompt 包含题目、参考答案、用户答案', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (msgs) => {
          const userMsg = msgs.find((m: any) => m.role === 'user')
          expect(userMsg?.content).toContain('请解释 Python 中 == 和 is 的区别')
          expect(userMsg?.content).toContain('== 比较值，is 比较引用')
          expect(userMsg?.content).toContain('用户提交的答案')
          return '85'
        }
      )
      await gradeByAI(makeShortQuestion(), '用户提交的答案')
    })
  })
})
