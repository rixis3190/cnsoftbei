import { useContext } from 'react'
import { AuthContext, type AuthContextType } from './AuthContextObject'

/** 读取认证上下文（必须在 AuthProvider 内使用） */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
