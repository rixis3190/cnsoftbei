import { describe, it, expect, vi } from 'vitest'

// Mock 全局 API 和 context，确保模块能正常加载
// 注意：hook 已从 Context 文件拆出（react-refresh/only-export-components），mock 路径需指向 hook 模块
vi.mock('../../src/context/usePageCache', () => ({
  usePageCache: () => ({ cachedState: null, saveState: vi.fn() }),
}))

vi.mock('../../src/context/useAuth', () => ({
  useAuth: () => ({
    user: { username: 'test-student', role: 'student', name: '测试学生' },
    login: vi.fn(() => true),
    logout: vi.fn(),
  }),
  getUserStoragePrefix: () => 'test-student_',
}))

vi.mock('../../src/services/api', () => ({
  streamChatCompletion: vi.fn(async () => '模拟回答'),
  chatCompletion: vi.fn(async () => '模拟回答'),
}))

// 页面组件 import 链路很长（antd + recharts + 各种 context），
// 开 coverage 插桩或机器负载高时会超过默认 5s / 15s 阈值导致 flaky。
// 这里统一放宽到 30s：只放宽超时上限，不改变任何断言逻辑。
const IMPORT_TIMEOUT = 60000

// ==================== 页面模块导入测试 ====================

describe('页面模块导入', () => {
  it('Home 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Home')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Practice 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Practice')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Tutor 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Tutor')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Profile 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Profile')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Resources 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Resources')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Path 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Path')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Assessment 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Assessment')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('Login 模块可正常导入', { timeout: IMPORT_TIMEOUT }, async () => {
    const mod = await import('../../src/pages/Login')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})

// ==================== 服务模块导入测试 ====================

describe('服务模块导入', () => {
  it('api 模块可正常导入', async () => {
    const mod = await import('../../src/services/api')
    expect(mod.streamChatCompletion).toBeDefined()
    expect(mod.chatCompletion).toBeDefined()
  })

  it('practiceGrader 模块可正常导入', async () => {
    const mod = await import('../../src/services/practiceGrader')
    expect(mod.checkAnswer).toBeDefined()
    expect(mod.gradeByAI).toBeDefined()
    expect(mod.gradeByAIVerified).toBeDefined()
    expect(mod.assertScoreReasonable).toBeDefined()
    expect(mod.calculateModuleProgress).toBeDefined()
  })

  it('tutorQuality 模块可正常导入', async () => {
    const mod = await import('../../src/services/tutorQuality')
    expect(mod.validateAnswerRules).toBeDefined()
    expect(mod.findBestMatchByKeywords).toBeDefined()
    expect(mod.extractTokens).toBeDefined()
    expect(mod.jaccardSimilarity).toBeDefined()
  })

  it('learningOrchestrator 模块可正常导入', async () => {
    const mod = await import('../../src/services/learningOrchestrator')
    expect(mod.buildLearningProfileSnapshot).toBeDefined()
    expect(mod.buildLearningPathPlan).toBeDefined()
  })

  it('promptBuilder 模块可正常导入', async () => {
    const mod = await import('../../src/services/promptBuilder')
    expect(mod.buildTutorSystemPrompt).toBeDefined()
    expect(mod.buildFollowUpSystemPrompt).toBeDefined()
    expect(mod.loadProfile).toBeDefined()
  })

  it('multiAgentFramework 模块可正常导入', async () => {
    const mod = await import('../../src/services/multiAgentFramework')
    expect(mod.multiAgentScheduler).toBeDefined()
    expect(mod.resourceGenerator).toBeDefined()
  })
})