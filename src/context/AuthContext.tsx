/**
 * AuthContext — 认证上下文
 *
 * 前端模拟的用户认证系统，使用 localStorage 存储用户数据。
 * 支持三种角色：student / teacher / admin
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

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

interface AuthContextType {
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

// ==================== 常量 ====================

const USERS_KEY = 'users'
const CURRENT_USER_KEY = 'currentUser'

// 预置账号
const SEED_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: '管理员',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-teacher1',
    username: 'teacher1',
    password: 'teacher123',
    role: 'teacher',
    name: '李老师',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-student1',
    username: 'student1',
    password: 'student123',
    role: 'student',
    name: '张三',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

// ==================== 工具函数 ====================

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function loadCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(CURRENT_USER_KEY)
  }
}

/** 确保预置账号存在（首次使用时 seed） */
function seedUsers(): User[] {
  let users = loadUsers()
  if (users.length === 0) {
    users = [...SEED_USERS]
    saveUsers(users)
  }
  return users
}

/**
 * 首帧登录态恢复结果。
 * `staleUser` 非空表示 localStorage 里的登录用户已不存在，需要清理（由 effect 完成写操作）。
 */
interface InitialAuthState {
  user: User | null
  staleUser: boolean
}

/** 初始化：seed 预置账号 + 恢复登录态。纯计算，可在首帧同步完成 */
function initAuthState(): InitialAuthState {
  seedUsers()
  const saved = loadCurrentUser()
  if (!saved) return { user: null, staleUser: false }
  // 验证用户仍然存在
  const exists = loadUsers().find(u => u.id === saved.id)
  return exists ? { user: exists, staleUser: false } : { user: null, staleUser: true }
}

// ==================== Context ====================

const AuthContext = createContext<AuthContextType | null>(null)

// ==================== Provider ====================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 登录态在首帧同步恢复，避免「先渲染未登录态再纠正」的闪烁与级联渲染
  const [initial] = useState<InitialAuthState>(initAuthState)
  const [currentUser, setCurrentUser] = useState<User | null>(initial.user)

  // 失效登录态的清理只涉及 localStorage 写入，不需要触发渲染
  useEffect(() => {
    if (initial.staleUser) {
      saveCurrentUser(null)
    }
  }, [initial.staleUser])

  const login = useCallback((username: string, password: string): boolean => {
    const users = loadUsers()
    const user = users.find(u => u.username === username && u.password === password)
    if (user) {
      setCurrentUser(user)
      saveCurrentUser(user)
      return true
    }
    return false
  }, [])

  const register = useCallback((
    username: string,
    password: string,
    name: string,
    role: UserRole = 'student',
  ): { success: boolean; message: string } => {
    const users = loadUsers()

    // 检查用户名重复
    if (users.find(u => u.username === username)) {
      return { success: false, message: '用户名已存在' }
    }

    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username,
      password,
      role,
      name,
      createdAt: new Date().toISOString(),
    }

    users.push(newUser)
    saveUsers(users)

    // 自动登录
    setCurrentUser(newUser)
    saveCurrentUser(newUser)

    return { success: true, message: '注册成功' }
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    saveCurrentUser(null)
  }, [])

  const getAllUsers = useCallback((): User[] => {
    return loadUsers()
  }, [])

  const deleteUser = useCallback((id: string) => {
    const users = loadUsers().filter(u => u.id !== id)
    saveUsers(users)
    // 如果删除的是当前用户，登出
    if (currentUser?.id === id) {
      setCurrentUser(null)
      saveCurrentUser(null)
    }
  }, [currentUser])

  const updateUserRole = useCallback((id: string, role: UserRole) => {
    const users = loadUsers()
    const user = users.find(u => u.id === id)
    if (user) {
      user.role = role
      saveUsers(users)
      // 如果修改的是当前用户，同步更新
      if (currentUser?.id === id) {
        setCurrentUser({ ...currentUser, role })
        saveCurrentUser({ ...currentUser, role })
      }
    }
  }, [currentUser])

  const resetPassword = useCallback((id: string, newPassword: string) => {
    const users = loadUsers()
    const user = users.find(u => u.id === id)
    if (user) {
      user.password = newPassword
      saveUsers(users)
    }
  }, [])

  const value: AuthContextType = {
    currentUser,
    isLoggedIn: !!currentUser,
    login,
    register,
    logout,
    isAdmin: currentUser?.role === 'admin',
    isTeacher: currentUser?.role === 'teacher' || currentUser?.role === 'admin',
    isStudent: currentUser?.role === 'student',
    getAllUsers,
    deleteUser,
    updateUserRole,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ==================== Hook ====================

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** 获取当前用户的 localStorage key 前缀 */
export function getUserStoragePrefix(userId: string): string {
  return `${userId}_`
}
