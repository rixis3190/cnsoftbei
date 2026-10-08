/**
 * 页面缓存的 Context 对象与类型。
 *
 * 单独成文件的原因同 `AuthContextObject.ts`：让 `PageCacheContext.tsx` 只导出组件，
 * 满足 `react-refresh/only-export-components`。
 */

import { createContext } from 'react'

export interface PageState {
  [key: string]: unknown
}

export interface PageCacheContextType {
  getState: (pageKey: string) => unknown
  setState: (pageKey: string, state: unknown) => void
  clearState: (pageKey: string) => void
}

export const PageCacheContext = createContext<PageCacheContextType | null>(null)
