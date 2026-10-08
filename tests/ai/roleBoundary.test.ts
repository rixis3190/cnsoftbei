import { describe, it, expect, vi, beforeEach } from 'vitest'

// ==================== Mock ====================
vi.mock('../../src/services/api', () => ({
  streamChatCompletion: vi.fn(),
  chatCompletion: vi.fn(),
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

import { streamChatCompletion } from '../../src/services/api'
import { gradeByAI } from '../../src/services/practiceGrader'
import {
  buildTutorSystemPrompt,
  buildFollowUpSystemPrompt,
  buildFollowUpUserPrompt,
  buildRegenerateSystemPrompt,
  buildProfileAnalysisPrompt,
  buildQuizAnalysisPrompt,
  buildGradeByAIMessages,
  buildRelevanceCheckPrompt,
} from '../../src/services/promptBuilder'
import type { StudentProfile, PracticeQuestion, QAItem } from '../../src/types'

function makeProfile(): StudentProfile {
  return {
    id: 'student-1',
    name: '张三',
    major: '计算机科学',
    grade: '大三',
    updatedAt: '',
    dimensions: [
      { key: 'knowledgeBase', label: '知识基础', value: 'Python 基础扎实', level: '中' },
      { key: 'cognitiveStyle', label: '认知风格', value: '视觉型学习者', level: '高' },
      { key: 'errorProne', label: '易错点', value: '递归算法', level: '低' },
      { key: 'learningPace', label: '学习节奏', value: '接受较快', level: '高' },
      { key: 'interestDirection', label: '兴趣方向', value: '人工智能', level: '高' },
      { key: 'studyHabit', label: '学习习惯', value: '边做边学', level: '中' },
    ],
  }
}

// ==================== L2b: 角色边界测试 ====================

describe('L2b: 角色边界 — 发给 AI 的 messages 验证', () => {
  beforeEach(() => {
    vi.mocked(streamChatCompletion).mockReset()
    localStorage.clear()
  })

  // ---------- Tutor 角色约束 ----------
  describe('Tutor 角色约束', () => {
    it('正常提问 — system prompt 包含 "AI辅导老师" 角色定义', () => {
      const prompt = buildTutorSystemPrompt('text', null)
      expect(prompt).toContain('AI辅导老师')
      expect(prompt).toContain('详细解答')
    })

    it('正常提问 — system prompt 不包含评分标准（那是 gradeByAI 的）', () => {
      const prompt = buildTutorSystemPrompt('text', null)
      expect(prompt).not.toContain('0-100的整数分数')
      expect(prompt).not.toContain('编程教育评估专家')
    })

    it('画像注入 — system prompt 包含画像维度', () => {
      const prompt = buildTutorSystemPrompt('text', makeProfile())
      expect(prompt).toContain('张三')
      expect(prompt).toContain('计算机科学')
      expect(prompt).toContain('Python 基础扎实')
      expect(prompt).toContain('视觉型学习者')
    })

    it('画像注入 — 包含调整指令', () => {
      const prompt = buildTutorSystemPrompt('text', makeProfile())
      expect(prompt).toContain('请根据以上画像调整回答风格和深度')
    })
  })

  // ---------- 追问上下文隔离 ----------
  describe('追问上下文隔离', () => {
    it('追问 prompt 包含相关性判断指令', () => {
      const prompt = buildFollowUpSystemPrompt(null)
      expect(prompt).toContain('追问')
      expect(prompt).toContain('相关')
      expect(prompt).toContain('无关')
    })

    it('追问 prompt 包含 "不要显式输出判断"', () => {
      const prompt = buildFollowUpSystemPrompt(null)
      expect(prompt).toContain('不要显式输出你的判断过程')
    })

    it('追问 prompt 包含画像', () => {
      const prompt = buildFollowUpSystemPrompt(makeProfile())
      expect(prompt).toContain('张三')
    })

    it('追问 user prompt 包含父问答上下文', () => {
      const qa: QAItem = {
        id: 'qa-1',
        question: '什么是装饰器？',
        answer: '装饰器是 Python 的语法糖...',
        type: 'text',
        helpful: true,
        createdAt: '',
      }
      // 原实现误调 buildFollowUpSystemPrompt(null)，标题说测 user prompt 却测了 system prompt，
      // 断言仅 toContain('追问') 恒真 → 假通过。改为真正校验 buildFollowUpUserPrompt 的输出。
      const prompt = buildFollowUpUserPrompt(qa, '那装饰器怎么用？')
      expect(prompt).toContain('什么是装饰器？')
      expect(prompt).toContain('装饰器是 Python 的语法糖...')
      expect(prompt).toContain('那装饰器怎么用？')
    })
  })

  // ---------- 点踩重生成约束 ----------
  describe('点踩重生成约束', () => {
    it('重生成 prompt 包含 "点了踩" 标识', () => {
      const prompt = buildRegenerateSystemPrompt(null)
      expect(prompt).toContain('点了"踩"')
    })

    it('重生成 prompt 包含格式要求', () => {
      const prompt = buildRegenerateSystemPrompt(null)
      expect(prompt).toContain('## 📊 原因分析')
      expect(prompt).toContain('## ✅ 重新解答')
    })

    it('重生成 prompt 包含画像', () => {
      const prompt = buildRegenerateSystemPrompt(makeProfile())
      expect(prompt).toContain('张三')
    })
  })

  // ---------- 相关性判断约束 ----------
  describe('相关性判断约束', () => {
    it('只允许回复 "相关" 或 "无关"', () => {
      const prompt = buildRelevanceCheckPrompt()
      expect(prompt).toContain('仅回复"相关"或"无关"')
      expect(prompt).toContain('不要输出其他任何内容')
    })
  })

  // ---------- Profile 画像分析约束 ----------
  describe('Profile 画像分析约束', () => {
    it('system prompt 包含 "画像构建智能体" 角色', () => {
      const { system } = buildProfileAnalysisPrompt(makeProfile(), '你好')
      expect(system).toContain('画像构建智能体')
    })

    it('system prompt 包含 JSON 输出格式约束', () => {
      const { system } = buildProfileAnalysisPrompt(makeProfile(), '你好')
      expect(system).toContain('只输出JSON，不要其他内容')
    })

    it('system prompt 包含已有画像信息', () => {
      const { system } = buildProfileAnalysisPrompt(makeProfile(), '你好')
      expect(system).toContain('张三')
      expect(system).toContain('Python 基础扎实')
    })

    it('测试答题分析 — 包含质量约束', () => {
      const prompt = buildQuizAnalysisPrompt()
      expect(prompt).toContain('不少于10个字')
      expect(prompt).toContain('不要简单复述选项文字')
    })

    it('测试答题分析 — 包含客观评价要求', () => {
      const prompt = buildQuizAnalysisPrompt()
      expect(prompt).toContain('客观评价')
      expect(prompt).toContain('扎实')
    })
  })

  // ---------- gradeByAI 角色隔离 ----------
  describe('gradeByAI 角色隔离', () => {
    it('gradeByAI 的 system prompt 包含评分标准', () => {
      const { system } = buildGradeByAIMessages('题目', '参考答案', '用户答案')
      expect(system).toContain('编程教育评估专家')
      expect(system).toContain('90-100')
      expect(system).toContain('不要随意给高分')
    })

    it('gradeByAI 的 user prompt 只要求输出数字', () => {
      const { user } = buildGradeByAIMessages('题目', '参考答案', '用户答案')
      expect(user).toContain('只输出一个0-100的整数分数')
      expect(user).toContain('不要输出其他内容')
    })

    it('gradeByAI 真实调用 — messages 格式正确', async () => {
      vi.mocked(streamChatCompletion).mockImplementation(
        async (msgs) => {
          // 验证传给 API 的 messages 结构
          const systemMsg = msgs.find((m: any) => m.role === 'system')
          const userMsg = msgs.find((m: any) => m.role === 'user')
          expect(systemMsg).toBeDefined()
          expect(userMsg).toBeDefined()
          expect(systemMsg!.content).toContain('编程教育评估专家')
          expect(userMsg!.content).toContain('请只输出一个0-100的整数分数')
          return '85'
        }
      )

      const q: PracticeQuestion = {
        id: 'q1', moduleId: 'm1', type: 'short', difficulty: 'medium',
        category: 'core', tags: ['syntax'],
        question: '解释装饰器',
        sampleAnswer: '装饰器是语法糖',
      }
      await gradeByAI(q, '用户答案')
    })
  })

  // ---------- 跨场景角色不混淆 ----------
  describe('跨场景角色不混淆', () => {
    it('Tutor prompt 不包含评分标准', () => {
      const tutorPrompt = buildTutorSystemPrompt('text', null)
      expect(tutorPrompt).not.toContain('0-100的整数分数')
      expect(tutorPrompt).not.toContain('编程教育评估专家')
    })

    it('gradeByAI prompt 不包含 Tutor 角色', () => {
      const { system } = buildGradeByAIMessages('题目', '参考', '答案')
      expect(system).not.toContain('AI辅导老师')
      expect(system).not.toContain('画像')
    })

    it('画像分析 prompt 不包含 Tutor 角色', () => {
      const { system } = buildProfileAnalysisPrompt(makeProfile(), '你好')
      expect(system).not.toContain('AI辅导老师')
      expect(system).not.toContain('辅导')
    })

    it('相关性判断 prompt 不包含画像', () => {
      const prompt = buildRelevanceCheckPrompt()
      expect(prompt).not.toContain('画像')
      expect(prompt).not.toContain('知识基础')
    })

    it('Tutor prompt 不包含 JSON 输出约束', () => {
      const prompt = buildTutorSystemPrompt('text', null)
      expect(prompt).not.toContain('只输出JSON')
    })

    it('画像分析 prompt 不包含评分标准', () => {
      const { system } = buildProfileAnalysisPrompt(makeProfile(), '你好')
      expect(system).not.toContain('0-100的整数分数')
    })
  })
})
