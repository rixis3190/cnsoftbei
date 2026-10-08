/**
 * AuthContext 的类型与 Context 对象。
 *
 * 单独成文件的原因：`react-refresh/only-export-components` 要求
 * 只导出组件的文件不导出 hook / 常量，否则开发期 Fast Refresh 失效。
 * Provider 组件见 `AuthContext.tsx`，消费用的 hook 见 `useAuth.ts`。
 */

import { createContext } from 'react'

// ==================== 类型定义 ====================

export type UserRole = 'student' | 'teacher' | 'admin'

export interface User {
  id: string
  username: string
  password: string
  role: UserRole
  name: string
  createdAt: string
}

export interface AuthContextType {
  currentUser: User | null
  isLoggedIn: boolean
  login: (username: string, password: string) => boolean
  register: (username: string, password: string, name: string, role?: UserRole) => { success: boolean; message: string }
  logout: () => void
  isAdmin: boolean
  isTeacher: boolean
  isStudent: boolean
  getAllUsers: () => User[]
  deleteUser: (id: string) => void
  updateUserRole: (id: string, role: UserRole) => void
  resetPassword: (id: string, newPassword: string) => void
}

// ==================== Context ====================

export const AuthContext = createContext<AuthContextType | null>(null)
