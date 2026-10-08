import '@testing-library/jest-dom/vitest'
import { server } from './mocks/server'

// ==================== localStorage Mock ====================
function createStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
    _dump: () => ({ ...store }),
    _setRaw: (data: Record<string, string>) => { store = { ...data } },
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock })

// ==================== window.dispatchEvent Mock ====================
const listeners: Record<string, ((...args: any[]) => void)[]> = {}
const originalAddEventListener = window.addEventListener.bind(window)
const originalRemoveEventListener = window.removeEventListener.bind(window)

window.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
  if (!listeners[type]) listeners[type] = []
  listeners[type].push(listener as (...args: unknown[]) => void)
  originalAddEventListener(type, listener)
}

window.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
  if (listeners[type]) {
    listeners[type] = listeners[type].filter(l => l !== listener)
  }
  originalRemoveEventListener(type, listener)
}

// ==================== fetch Mock ====================
// 每个测试前清理
beforeEach(() => {
  localStorageMock.clear()
  sessionStorageMock.clear()
  // 清理事件监听器
  for (const type of Object.keys(listeners)) {
    listeners[type] = []
  }
})

// 导出 mock 工具供测试使用
export { localStorageMock, sessionStorageMock }

// ==================== console 抑制（可选） ====================
// 某些测试会产生预期的 console.error，可在单个测试中用 vi.spyOn 恢复

// ==================== msw 服务器生命周期 ====================
// 启动 msw 服务器，拦截所有 fetch 请求
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
