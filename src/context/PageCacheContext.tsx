import React, { createContext, useContext, useCallback, useRef } from 'react';

interface PageState {
  [key: string]: unknown;
}

interface PageCacheContextType {
  getState: (pageKey: string) => unknown;
  setState: (pageKey: string, state: unknown) => void;
  clearState: (pageKey: string) => void;
}

const SESSION_KEY_PREFIX = 'page_cache_';

const PageCacheContext = createContext<PageCacheContextType | null>(null);

export const PageCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cacheRef = useRef<PageState>({});

  const getState = useCallback((pageKey: string) => {
    if (cacheRef.current[pageKey] !== undefined) {
      return cacheRef.current[pageKey];
    }
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_PREFIX + pageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        cacheRef.current[pageKey] = parsed;
        return parsed;
      }
    } catch {
      // sessionStorage 不可读（隐私模式 / 配额禁用）时降级为纯内存缓存
    }
    return undefined;
  }, []);

  const setState = useCallback((pageKey: string, state: unknown) => {
    cacheRef.current[pageKey] = state;
    try {
      sessionStorage.setItem(SESSION_KEY_PREFIX + pageKey, JSON.stringify(state));
    } catch {
      // 写入失败（如超配额）不影响本次会话内的内存缓存
    }
  }, []);

  const clearState = useCallback((pageKey: string) => {
    delete cacheRef.current[pageKey];
    try {
      sessionStorage.removeItem(SESSION_KEY_PREFIX + pageKey);
    } catch {
      // 忽略：内存缓存已在上一步清除
    }
  }, []);

  return (
    <PageCacheContext.Provider value={{ getState, setState, clearState }}>
      {children}
    </PageCacheContext.Provider>
  );
};

/**
 * 读取/写入指定页面的会话缓存。
 *
 * `T` 为该页面缓存对象的结构，由调用方显式声明，
 * 这样 `cachedState` 的字段访问与 `saveState` 的入参都受类型约束。
 */
export function usePageCache<T>(pageKey: string): {
  cachedState: T | undefined;
  saveState: (state: T) => void;
} {
  const context = useContext(PageCacheContext);
  if (!context) {
    throw new Error('usePageCache must be used within PageCacheProvider');
  }

  const { getState, setState } = context;

  const cachedState = getState(pageKey) as T | undefined;

  const saveState = (state: T) => {
    setState(pageKey, state);
  };

  return { cachedState, saveState };
}
