import { useState, useCallback, useRef } from 'react'

/**
 * 防抖提交 hook
 *
 * 返回 loading 状态和包装后的提交函数。
 * 在 loading 期间重复调用会被忽略。
 *
 * @example
 * const [submitting, handleSubmit] = useDebounce(async () => { ... })
 * <Button loading={submitting} onClick={handleSubmit}>提交</Button>
 */
export function useDebounce<T extends (...args: never[]) => unknown>(
  fn: T,
): [boolean, T] {
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  const wrapped = useCallback(
    async (...args: Parameters<T>) => {
      if (lockRef.current) return
      lockRef.current = true
      setLoading(true)
      try {
        await fn(...args)
      } finally {
        setLoading(false)
        lockRef.current = false
      }
    },
    [fn],
  ) as T

  return [loading, wrapped]
}
