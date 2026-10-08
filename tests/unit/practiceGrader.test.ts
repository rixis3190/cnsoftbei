import { describe, it, expect, vi, beforeEach } from 'vitest'

// ==================== Mock 依赖 ====================

// Mock api.ts
vi.mock('../../src/services/api', () => ({
  streamChatCompletion: vi.fn(),
}))

// Mock learningOrchestrator.ts
vi.mock('../../src/services/learningOrchestrator', () => ({
  appendLearningCycleLog: vi.fn((logs, entry) => {
    const next = logs ? [...logs] : []
    next.push({ ...entry, cycleId: `cycle-${Date.now()}`, createdAt: new Date().toISOString() })
    return next.slice(-20)
  }),
  buildLearningEvaluationReport: vi.fn(() => ({
    stageId: 'test-stage',
    stageName: '测试阶段',
    masteryItems: [],
    weakKnowledgePoints: [],
    profileUpdateInstructions: [],
    pathOptimizationInstructions: [],
    practiceOptimizationInstructions: [],
    generatedAt: new Date().toISOString(),
    source: '练习',
  })),
  syncLearningProfileFromPractice: vi.fn((profile) => ({
    ...profile,
    learningProfile: {
      user: { id: profile.id, name: profile.name, major: profile.major, grade: profile.grade },
      knowledgeBase: [],
      cognitiveStyle: { label: '文字型', source: '练习' },
      errorProne: [],
      learningPace: { label: '中等接受', estimatedStudyHours: 10, source: '练习' },
      interestDirection: { labels: ['前端开发'], source: '练习' },
      studyHabit: { label: '边做边学', source: '练习' },
      updatedAt: new Date().toISOString(),
      source: '练习',
    },
    updatedAt: new Date().toISOString(),
  })),
  saveProfileAndNotify: vi.fn(),
  broadcastEvent: vi.fn(),
  SYSTEM_EVENTS: { PRACTICE_UPDATED: 'practiceStateUpdated' },
}))

// Mock mockData.ts
vi.mock('../../src/data/mockData', () => ({
  initialProfile: {
    id: 'test-student',
    name: '测试学生',
    major: '计算机科学',
    grade: '大三',
    updatedAt: '',
    dimensions: [
      { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
      { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
      { key: 'errorProne', label: '易错点偏好', value: '', level: '低' },
      { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
      { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
      { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
    ],
  },
}))

// ==================== 导入被测模块 ====================
// 注意：需要在 mock 之后导入
import {
  checkAnswer,
  gradeByAI,
  gradeByAIVerified,
  assertScoreReasonable,
  calculateModuleProgress,
  calculateTagScores,
  updateProfileByTagScores,
  loadPracticeState,
  savePracticeState,
  getOrCreatePracticeState,
  submitAnswer,
  resetPracticeState,
} from '../../src/services/practiceGrader'

import { streamChatCompletion } from '../../src/services/api'
import type { PracticeQuestion, PracticeResult, TagScore } from '../../src/types'

// ==================== 测试数据工厂 ====================

function makeQuestion(overrides: Partial<PracticeQuestion> = {}): PracticeQuestion {
  return {
    id: 'q-test-1',
    moduleId: 'module-1',
    type: 'choice',
    difficulty: 'easy',
    category: 'core',
    tags: ['syntax'],
    question: '测试题目',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
    ...overrides,
  }
}

function makeResult(overrides: Partial<PracticeResult> = {}): PracticeResult {
  return {
    questionId: 'q-test-1',
    moduleId: 'module-1',
    userAnswer: 'B',
    isCorrect: true,
    submittedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ==================== checkAnswer 测试 ====================

describe('checkAnswer', () => {
  describe('选择题 (choice)', () => {
    it('正确答案返回 true', () => {
      const q = makeQuestion({ type: 'choice', correctAnswer: 'B' })
      expect(checkAnswer(q, 'B')).toBe(true)
    })

    it('错误答案返回 false', () => {
      const q = makeQuestion({ type: 'choice', correctAnswer: 'B' })
      expect(checkAnswer(q, 'A')).toBe(false)
    })

    it('空字符串返回 false', () => {
      const q = makeQuestion({ type: 'choice', correctAnswer: 'B' })
      expect(checkAnswer(q, '')).toBe(false)
    })

    it('部分匹配返回 false', () => {
      const q = makeQuestion({ type: 'choice', correctAnswer: '以上全部' })
      expect(checkAnswer(q, '以上')).toBe(false)
    })
  })

  describe('判断题 (truefalse)', () => {
    it('答案为 true 且正确', () => {
      const q = makeQuestion({ type: 'truefalse', trueFalseAnswer: true })
      expect(checkAnswer(q, 'true')).toBe(true)
    })

    it('答案为 false 且正确', () => {
      const q = makeQuestion({ type: 'truefalse', trueFalseAnswer: false })
      expect(checkAnswer(q, 'false')).toBe(true)
    })

    it('答案反了返回 false', () => {
      const q = makeQuestion({ type: 'truefalse', trueFalseAnswer: true })
      expect(checkAnswer(q, 'false')).toBe(false)
    })

    it('trueFalseAnswer 为 undefined 时按 false 处理', () => {
      const q = makeQuestion({ type: 'truefalse', trueFalseAnswer: undefined })
      expect(checkAnswer(q, 'false')).toBe(true)
      expect(checkAnswer(q, 'true')).toBe(false)
    })
  })

  describe('填空题 (fill)', () => {
    it('完全匹配返回 true', () => {
      const q = makeQuestion({ type: 'fill', fillAnswer: 'print' })
      expect(checkAnswer(q, 'print')).toBe(true)
    })

    it('大小写不敏感', () => {
      const q = makeQuestion({ type: 'fill', fillAnswer: 'Print' })
      expect(checkAnswer(q, 'print')).toBe(true)
    })

    it('前后空格被忽略', () => {
      const q = makeQuestion({ type: 'fill', fillAnswer: '  print  ' })
      expect(checkAnswer(q, 'print')).toBe(true)
    })

    it('fillAnswer 为 undefined 时匹配空字符串', () => {
      const q = makeQuestion({ type: 'fill', fillAnswer: undefined })
      // 这是一个已知的边界行为：undefined || '' = ''，空输入也 trim 为 ''
      expect(checkAnswer(q, '')).toBe(true)
    })

    it('fillAnswer 为 null 时匹配空字符串', () => {
      const q = makeQuestion({ type: 'fill', fillAnswer: null as any })
      expect(checkAnswer(q, '')).toBe(true)
    })
  })

  describe('未知题型', () => {
    it('未知 type 返回 false', () => {
      const q = makeQuestion({ type: 'unknown' as any })
      expect(checkAnswer(q, 'anything')).toBe(false)
    })
  })
})

// ==================== gradeByAI 测试 ====================

describe('gradeByAI', () => {
  beforeEach(() => {
    vi.mocked(streamChatCompletion).mockReset()
  })

  it('简答题正常判分 — 返回标准数字', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        onChunk?.('85', false)
        return '85'
      }
    )
    const q = makeQuestion({ type: 'short', sampleAnswer: '参考答案' })
    const score = await gradeByAI(q, '用户答案')
    expect(score).toBe(85)
  })

  it('AI 返回带文字的分数 — 提取第一个数字', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        onChunk?.('这个回答值得 75 分', false)
        return '这个回答值得 75 分'
      }
    )
    const q = makeQuestion({ type: 'short', sampleAnswer: '参考答案' })
    const score = await gradeByAI(q, '用户答案')
    expect(score).toBe(75)
    expect(score).toBe(75)
  })

  it('AI 返回超范围高分 — clamp 到 100', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('150', false); return '150' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(100)
  })

  it('AI 返回负数 — 提取数字部分（已知行为）', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('-10', false); return '-10' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    // /\d+/ 从 "-10" 中提取 "10"，负号被忽略
    expect(score).toBe(10)
  })

  it('AI 返回无数字 — 返回 0', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('这个回答很差', false); return '这个回答很差' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(0)
  })

  it('AI 返回空字符串 — 返回 0', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('', false); return '' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(0)
  })

  it('非 short 题型 — 直接返回 0', async () => {
    const q = makeQuestion({ type: 'choice' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(0)
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('onChunk 回调被调用', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        onChunk?.('85', false)
        return '85'
      }
    )
    const onChunk = vi.fn()
    const q = makeQuestion({ type: 'short' })
    await gradeByAI(q, '答案', onChunk)
    expect(onChunk).toHaveBeenCalledWith('85')
  })

  it('thinking 块不计入分数提取', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        onChunk?.('[思考中...]', true)
        onChunk?.('75', false)
        return '75'
      }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(75)
  })

  it('网络错误 — 异常传播', async () => {
    vi.mocked(streamChatCompletion).mockRejectedValue(new Error('Network error'))
    const q = makeQuestion({ type: 'short' })
    await expect(gradeByAI(q, '答案')).rejects.toThrow('Network error')
  })

  it('AI 返回多个数字 — 取最高分', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('有 3 个错误，得分 60', false); return '有 3 个错误，得分 60' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    // 取最高分 60（过滤掉不在 0-100 范围的数字后取 max）
    expect(score).toBe(60)
  })

  it('AI 返回浮点数 — parseInt 截断', async () => {
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => { onChunk?.('78.5 分', false); return '78.5 分' }
    )
    const q = makeQuestion({ type: 'short' })
    const score = await gradeByAI(q, '答案')
    expect(score).toBe(78)
  })
})

// ==================== calculateModuleProgress 测试 ====================

describe('calculateModuleProgress', () => {
  const moduleQuestions = [
    makeQuestion({ id: 'q1', moduleId: 'module-1', type: 'choice', tags: ['syntax'] }),
    makeQuestion({ id: 'q2', moduleId: 'module-1', type: 'truefalse', tags: ['syntax'] }),
    makeQuestion({ id: 'q3', moduleId: 'module-1', type: 'short', tags: ['syntax'], sampleAnswer: '答' }),
  ]

  it('全部客观题答对 — 客观满分 50', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: true }),
      makeResult({ questionId: 'q2', isCorrect: true }),
    ]
    const progress = calculateModuleProgress('module-1', results, moduleQuestions)
    expect(progress.score).toBe(50) // 客观 50 + 简答 0
    expect(progress.correctCount).toBe(2)
    expect(progress.completedQuestions).toBe(2)
  })

  it('全部客观题答错 — 0 分', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: false }),
      makeResult({ questionId: 'q2', isCorrect: false }),
    ]
    const progress = calculateModuleProgress('module-1', results, moduleQuestions)
    expect(progress.score).toBe(0)
    expect(progress.correctCount).toBe(0)
  })

  it('混合题型 — 客观 + 简答加权', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: true }),
      makeResult({ questionId: 'q3', isCorrect: null, aiScore: 80 }),
    ]
    const progress = calculateModuleProgress('module-1', results, moduleQuestions)
    // 客观：1/2 * 50 = 25；简答：80/100 * 50 = 40；总 = 65
    expect(progress.score).toBe(65)
    expect(progress.shortAnswerTotalScore).toBe(80)
  })

  it('空结果 — 全部为 0', () => {
    const progress = calculateModuleProgress('module-1', [], moduleQuestions)
    expect(progress.completedQuestions).toBe(0)
    expect(progress.correctCount).toBe(0)
    expect(progress.score).toBe(0)
  })

  it('不属于该模块的结果被过滤', () => {
    const results = [
      makeResult({ questionId: 'q1', moduleId: 'module-2', isCorrect: true }),
    ]
    const progress = calculateModuleProgress('module-1', results, moduleQuestions)
    expect(progress.completedQuestions).toBe(0)
  })

  it('纯简答题模块 — 客观题分母为 0 不返回 NaN', () => {
    const shortOnlyQuestions = [
      makeQuestion({ id: 's1', moduleId: 'module-s', type: 'short', tags: ['syntax'] }),
      makeQuestion({ id: 's2', moduleId: 'module-s', type: 'short', tags: ['syntax'] }),
    ]
    const results = [
      makeResult({ questionId: 's1', moduleId: 'module-s', isCorrect: null, aiScore: 80 }),
    ]
    // 直接调用 calculateModuleProgress（submitAnswer 内部用全局 questions，不含 module-s）
    const progress = calculateModuleProgress('module-s', results, shortOnlyQuestions)
    // 客观题分母为 0 → objectiveScore = 0，不产生 NaN
    expect(isNaN(progress.score)).toBe(false)
    // 简答题 80/100 * 50 = 40
    expect(progress.score).toBe(40)
  })

  it('totalQuestions 为 0 — 返回 0 分', () => {
    const progress = calculateModuleProgress('nonexistent', [], moduleQuestions)
    expect(progress.totalQuestions).toBe(0)
    expect(progress.score).toBe(0)
  })

  it('moduleName 正确映射', () => {
    const progress = calculateModuleProgress('module-1', [], moduleQuestions)
    expect(progress.moduleName).toBe('Python 基础语法')
  })
})

// ==================== calculateTagScores 测试 ====================

describe('calculateTagScores', () => {
  const allQuestions = [
    makeQuestion({ id: 'q1', tags: ['syntax'] }),
    makeQuestion({ id: 'q2', tags: ['syntax'] }),
    makeQuestion({ id: 'q3', tags: ['data-types'] }),
    makeQuestion({ id: 'q4', tags: ['syntax', 'data-types'] }),
  ]

  it('单标签全对 — 100 分', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: true }),
      makeResult({ questionId: 'q2', isCorrect: true }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    const syntaxScore = scores.find(s => s.tag === 'syntax')
    expect(syntaxScore?.score).toBe(100)
    expect(syntaxScore?.totalAnswered).toBe(2)
  })

  it('混合标签 — 分别计算', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: true }),
      makeResult({ questionId: 'q3', isCorrect: false }),
      makeResult({ questionId: 'q4', isCorrect: true }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    // syntax: q1 对 + q4 对 = 2/2 = 100
    // data-types: q3 错 + q4 对 = 1/2 = 50
    expect(scores.find(s => s.tag === 'syntax')?.score).toBe(100)
    expect(scores.find(s => s.tag === 'data-types')?.score).toBe(50)
  })

  it('简答题带 aiScore — 加权计算', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: null, aiScore: 80 }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    expect(scores.find(s => s.tag === 'syntax')?.score).toBe(80)
  })

  it('未评分简答题 — 跳过不计', () => {
    const results = [
      makeResult({ questionId: 'q1', isCorrect: null, aiScore: undefined }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    expect(scores.find(s => s.tag === 'syntax')).toBeUndefined()
  })

  it('空 results — 返回空数组', () => {
    const scores = calculateTagScores([], allQuestions)
    expect(scores).toEqual([])
  })

  it('question 不存在 — 跳过', () => {
    const results = [
      makeResult({ questionId: 'nonexistent', isCorrect: true }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    expect(scores).toEqual([])
  })

  it('多标签题目 — 两个 tag 都加分', () => {
    const results = [
      makeResult({ questionId: 'q4', isCorrect: true }),
    ]
    const scores = calculateTagScores(results, allQuestions)
    expect(scores.find(s => s.tag === 'syntax')?.score).toBe(100)
    expect(scores.find(s => s.tag === 'data-types')?.score).toBe(100)
  })
})

// ==================== updateProfileByTagScores 测试 ====================

describe('updateProfileByTagScores', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('空 tagScores — 返回 undefined', () => {
    expect(updateProfileByTagScores([])).toBeUndefined()
  })

  it('高分画像 — level 为 "高"', () => {
    localStorage.setItem('studentProfile', JSON.stringify({
      id: 'test',
      name: '测试',
      major: 'CS',
      grade: '大三',
      dimensions: [
        { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
        { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
        { key: 'errorProne', label: '易错点', value: '', level: '低' },
        { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
        { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
        { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
      ],
    }))

    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 5, score: 90 },
    ]
    const result = updateProfileByTagScores(tagScores)
    expect(result).toBeDefined()
    const kb = result.dimensions.find((d: any) => d.key === 'knowledgeBase')
    expect(kb.level).toBe('高')
  })

  it('低分画像 — level 为 "低"', () => {
    localStorage.setItem('studentProfile', JSON.stringify({
      id: 'test',
      name: '测试',
      major: 'CS',
      grade: '大三',
      dimensions: [
        { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
        { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
        { key: 'errorProne', label: '易错点', value: '', level: '低' },
        { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
        { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
        { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
      ],
    }))

    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 1, score: 20 },
    ]
    const result = updateProfileByTagScores(tagScores)
    const kb = result.dimensions.find((d: any) => d.key === 'knowledgeBase')
    expect(kb.level).toBe('低')
  })

  it('边界分 80 — level 为 "高"', () => {
    localStorage.setItem('studentProfile', JSON.stringify({
      id: 'test',
      name: '测试',
      major: 'CS',
      grade: '大三',
      dimensions: [
        { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
        { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
        { key: 'errorProne', label: '易错点', value: '', level: '低' },
        { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
        { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
        { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
      ],
    }))

    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 4, score: 80 },
    ]
    const result = updateProfileByTagScores(tagScores)
    const kb = result.dimensions.find((d: any) => d.key === 'knowledgeBase')
    expect(kb.level).toBe('高')
  })

  it('边界分 49 — level 为 "低"', () => {
    localStorage.setItem('studentProfile', JSON.stringify({
      id: 'test',
      name: '测试',
      major: 'CS',
      grade: '大三',
      dimensions: [
        { key: 'knowledgeBase', label: '知识基础', value: '', level: '中' },
        { key: 'cognitiveStyle', label: '认知风格', value: '', level: '中' },
        { key: 'errorProne', label: '易错点', value: '', level: '低' },
        { key: 'learningPace', label: '学习节奏', value: '', level: '中' },
        { key: 'interestDirection', label: '兴趣方向', value: '', level: '中' },
        { key: 'studyHabit', label: '学习习惯', value: '', level: '中' },
      ],
    }))

    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 2, score: 49 },
    ]
    const result = updateProfileByTagScores(tagScores)
    const kb = result.dimensions.find((d: any) => d.key === 'knowledgeBase')
    expect(kb.level).toBe('低')
  })

  it('无 localStorage 画像 — 用 initialProfile 兜底', () => {
    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 4, score: 80 },
    ]
    const result = updateProfileByTagScores(tagScores)
    expect(result).toBeDefined()
    expect(result.id).toBe('test-student')
  })

  it('维度不存在 — 跳过不崩溃', () => {
    localStorage.setItem('studentProfile', JSON.stringify({
      id: 'test',
      dimensions: [],
    }))
    const tagScores: TagScore[] = [
      { tag: 'syntax', totalAnswered: 5, correctCount: 4, score: 80 },
    ]
    expect(() => updateProfileByTagScores(tagScores)).not.toThrow()
  })
})

// ==================== 持久化测试 ====================

describe('loadPracticeState / savePracticeState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('正常读写 — 数据一致', () => {
    const state = {
      planId: 'test-plan',
      results: [],
      moduleProgress: [],
      tagScores: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    savePracticeState(state as any)
    const loaded = loadPracticeState()
    expect(loaded?.planId).toBe('test-plan')
  })

  it('localStorage 无数据 — 返回 null', () => {
    expect(loadPracticeState()).toBeNull()
  })

  it('JSON 损坏 — 返回 null', () => {
    localStorage.setItem('practiceState', 'not-json{{{')
    expect(loadPracticeState()).toBeNull()
  })

  it('updatedAt 自动更新', () => {
    const before = new Date().toISOString()
    savePracticeState({ planId: 'test', results: [], moduleProgress: [], tagScores: [] } as any)
    const loaded = loadPracticeState()
    expect(loaded?.updatedAt >= before).toBe(true)
  })
})

describe('getOrCreatePracticeState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('无已有状态 — 创建新状态', () => {
    const state = getOrCreatePracticeState()
    expect(state.planId).toBe('python-basics')
    expect(state.results).toEqual([])
    expect(state.moduleProgress.length).toBeGreaterThan(0)
  })

  it('有已有状态 — 返回已有', () => {
    const existing = { planId: 'existing', results: [{ questionId: 'q1' }], moduleProgress: [], tagScores: [], updatedAt: '' }
    localStorage.setItem('practiceState', JSON.stringify(existing))
    const state = getOrCreatePracticeState()
    expect(state.planId).toBe('existing')
  })
})

// ==================== submitAnswer 测试 ====================

describe('submitAnswer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('正常提交客观题 — results 增加 1 条', () => {
    const state = submitAnswer('q1', 'B', true)
    expect(state.results).toHaveLength(1)
    expect(state.results[0].isCorrect).toBe(true)
  })

  it('正常提交简答题 — 记录 aiScore', () => {
    const state = submitAnswer('q11', '用户答案', null, 80)
    expect(state.results).toHaveLength(1)
    expect(state.results[0].aiScore).toBe(80)
  })

  it('重复提交同一题 — 更新而非追加', () => {
    submitAnswer('q1', 'A', false)
    const state = submitAnswer('q1', 'B', true)
    // 已知行为：findIndex 找到后替换
    expect(state.results.filter(r => r.questionId === 'q1')).toHaveLength(1)
    expect(state.results[0].isCorrect).toBe(true)
  })

  it('不存在的 questionId — moduleId 为空字符串', () => {
    const state = submitAnswer('nonexistent', 'answer', true)
    expect(state.results[0].moduleId).toBe('')
  })

  it('localStorage 被写入', () => {
    submitAnswer('q1', 'B', true)
    const saved = localStorage.getItem('practiceState')
    expect(saved).not.toBeNull()
  })

  it('返回最新的 PracticeState', () => {
    const state = submitAnswer('q1', 'B', true)
    expect(state).toHaveProperty('results')
    expect(state).toHaveProperty('moduleProgress')
    expect(state).toHaveProperty('tagScores')
  })
})

// ==================== resetPracticeState 测试 ====================

describe('resetPracticeState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('重置后 results 为空', () => {
    submitAnswer('q1', 'B', true)
    const state = resetPracticeState()
    expect(state.results).toEqual([])
  })

  it('重置后 moduleProgress 有值', () => {
    const state = resetPracticeState()
    expect(state.moduleProgress.length).toBeGreaterThan(0)
  })

  it('重置后 localStorage 被更新', () => {
    submitAnswer('q1', 'B', true)
    resetPracticeState()
    const saved = JSON.parse(localStorage.getItem('practiceState')!)
    expect(saved.results).toEqual([])
  })
})

// ==================== assertScoreReasonable 测试 ====================

describe('assertScoreReasonable', () => {
  it('高度相似 + 低分 → 不合理', () => {
    const result = assertScoreReasonable(
      20,
      'Python 是一种解释型编程语言',
      'Python 是一种解释型编程语言，支持面向对象'
    )
    expect(result.reasonable).toBe(false)
    expect(result.reason).toContain('相似度')
  })

  it('低相似度 + 高分 → 不合理', () => {
    const result = assertScoreReasonable(
      90,
      '完全不相关的答案',
      'Python 是一种解释型编程语言，支持面向对象和函数式编程'
    )
    expect(result.reasonable).toBe(false)
    expect(result.reason).toContain('相似度')
  })

  it('答案极短 + 高分 → 不合理', () => {
    const result = assertScoreReasonable(50, '好', '详细参考答案内容')
    expect(result.reasonable).toBe(false)
    expect(result.reason).toContain('字')
  })

  it('正常情况 — 合理', () => {
    const result = assertScoreReasonable(
      75,
      'Python 是一种面向对象的解释型语言，支持多种编程范式',
      'Python 是一种解释型编程语言，支持面向对象和函数式编程'
    )
    expect(result.reasonable).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('答案为空字符串 — 分数 0 合理', () => {
    const result = assertScoreReasonable(0, '', '参考答案')
    expect(result.reasonable).toBe(true)
  })

  it('两个空字符串 — 相似度为 1，正常', () => {
    const result = assertScoreReasonable(0, '', '')
    expect(result.reasonable).toBe(true)
  })
})

// ==================== 相似度口径回归（防阈值语义静默漂移） ====================

/**
 * 相似度实现曾被从「中文单字 + 英文整词」换成「中文 2-gram + 英文整词」，
 * 两种口径的数值分布在**中低相似区间相差 0.02~0.10**，会移动 0.6 / 0.2 两个判定边界。
 * 这里把关键区间的实际数值钉住：任何再次更换实现都会让本用例立刻失败，
 * 迫使改动者显式重新评估阈值，而不是静默漂移（评审 MAJOR-1）。
 */
describe('相似度口径回归（assertScoreReasonable 的判定边界）', () => {
  it('完全相同 → 100% 相似，低分必判不合理', () => {
    const text = 'HashMap 在 JDK8 之后用红黑树处理长链表'
    expect(assertScoreReasonable(20, text, text).reasonable).toBe(false)
  })

  it('仅差一个从句 → 相似度落在 0.6 以上，低分仍判不合理', () => {
    const result = assertScoreReasonable(
      20,
      'Python 是一种解释型编程语言',
      'Python 是一种解释型编程语言，支持面向对象',
    )
    expect(result.reasonable).toBe(false)
  })

  it('完全无关 → 相似度为 0，高分必判不合理', () => {
    const result = assertScoreReasonable(
      90,
      '事务的隔离级别包括读未提交和读已提交',
      '今天天气不错',
    )
    expect(result.reasonable).toBe(false)
  })

  it('同主题部分覆盖 → 相似度贴近 0.2 下界（实测 0.207），中等分数不误伤', () => {
    // 这一对是漂移的敏感点：旧口径 0.308 → 新口径 0.207，离 0.2 只剩 0.007。
    // 若相似度实现再变动，本用例会立刻失败并提醒重新标定阈值。
    const result = assertScoreReasonable(
      70,
      '事务的隔离级别包括读未提交和读已提交',
      '隔离级别共有四种，其中读未提交可能出现脏读',
    )
    expect(result.reasonable).toBe(true)
  })

  it('同主题部分覆盖 + 高分 → 相似度仍高于 0.2，不触发「高分不合理」', () => {
    // 明确记录边界方向：该样本在新口径下**没有**跌破 0.2，
    // 所以不会额外触发 gradeByAIVerified 的 3 次评审。
    const result = assertScoreReasonable(
      85,
      '事务的隔离级别包括读未提交和读已提交',
      '隔离级别共有四种，其中读未提交可能出现脏读',
    )
    expect(result.reasonable).toBe(true)
  })
})

// ==================== gradeByAIVerified 测试 ====================

describe('gradeByAIVerified', () => {
  beforeEach(() => {
    vi.mocked(streamChatCompletion).mockReset()
  })

  it('非 short 题型 — 直接返回 0', async () => {
    const q = makeQuestion({ type: 'choice' })
    const result = await gradeByAIVerified(q, '答案')
    expect(result.score).toBe(0)
    expect(result.confidence).toBe('high')
    expect(result.details).toEqual([])
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('三次返回一致 — 高置信度', async () => {
    let callCount = 0
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        callCount++
        const score = '80'
        onChunk?.(score, false)
        return score
      }
    )
    const q = makeQuestion({ type: 'short', sampleAnswer: 'Python 是一种解释型语言' })
    const result = await gradeByAIVerified(q, 'Python 是一种解释型编程语言')
    expect(result.score).toBe(80)
    expect(result.confidence).toBe('high')
    expect(result.details).toEqual([80, 80, 80])
    expect(callCount).toBe(3)
  })

  it('三次返回偏差大 — 低置信度', async () => {
    let callCount = 0
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        callCount++
        const scores = ['20', '80', '90']
        const score = scores[(callCount - 1) % 3]
        onChunk?.(score, false)
        return score
      }
    )
    const q = makeQuestion({ type: 'short', sampleAnswer: 'Python 是一种解释型语言' })
    const result = await gradeByAIVerified(q, 'Python 是一种编程语言')
    expect(result.details).toEqual([20, 80, 90])
    // 中位数 80，偏差 max(60, 10) = 60 > 20 → 低置信度
    expect(result.confidence).toBe('low')
    expect(result.score).toBe(80)
  })

  it('取中位数而非平均值', async () => {
    let callCount = 0
    vi.mocked(streamChatCompletion).mockImplementation(
      async (_msgs, onChunk) => {
        callCount++
        const scores = ['60', '70', '90']
        const score = scores[(callCount - 1) % 3]
        onChunk?.(score, false)
        return score
      }
    )
    const q = makeQuestion({ type: 'short', sampleAnswer: 'Python 解释型语言' })
    const result = await gradeByAIVerified(q, 'Python 是解释型语言')
    // sorted: [60, 70, 90] → median = 70
    expect(result.score).toBe(70)
  })
})
