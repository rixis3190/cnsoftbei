import { useContext } from 'react'
import { PageCacheContext } from './PageCacheObject'

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
