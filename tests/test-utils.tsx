/* eslint-disable react-refresh/only-export-components */
/**
 * test-utils.tsx
 *
 * 自定义 render 函数，包裹必要的 Context Provider
 * 用于组件测试
 */
import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'

// 模拟 PageCacheContext
const PageCacheContext = React.createContext<{
  cachedState: any
  saveState: (state: any) => void
}>({
  cachedState: null,
  saveState: () => {},
})

// 模拟 AuthContext
const AuthContext = React.createContext<{
  user: any
  login: (u: string, p: string) => boolean
  logout: () => void
}>({
  user: { username: 'test-student', role: 'student', name: '测试学生' },
  login: () => true,
  logout: () => {},
})

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <PageCacheContext.Provider value={{ cachedState: null, saveState: () => {} }}>
      <AuthContext.Provider value={{
        user: { username: 'test-student', role: 'student', name: '测试学生' },
        login: () => true,
        logout: () => {},
      }}>
        {children}
      </AuthContext.Provider>
    </PageCacheContext.Provider>
  )
}

function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// 导出工厂函数
export function makeQAItem(overrides: Record<string, any> = {}) {
  return {
    id: `qa-${Math.random().toString(36).slice(2, 8)}`,
    question: '测试问题',
    answer: '测试回答',
    type: 'text',
    helpful: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makePracticeQuestion(overrides: Record<string, any> = {}) {
  return {
    id: `q-${Math.random().toString(36).slice(2, 8)}`,
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

export { renderWithProviders }
export default renderWithProviders
