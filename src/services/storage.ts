/**
 * storage — 用户隔离的 localStorage 工具
 *
 * 所有业务数据的 key 按当前用户 ID 前缀隔离。
 * 全局数据（如用户列表）不加前缀。
 */

const CURRENT_USER_KEY = 'currentUser'

/** 获取当前登录用户的 ID（无用户时返回 null） */
export function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    const user = JSON.parse(raw)
    return user?.id || null
  } catch {
    return null
  }
}

/** 生成用户隔离的 key */
export function userKey(key: string): string {
  const userId = getCurrentUserId()
  if (!userId) return key // 未登录时用原始 key（兜底）
  return `${userId}_${key}`
}

/** 获取指定用户的 localStorage key 前缀 */
export function getUserStoragePrefix(userId: string): string {
  return `${userId}_`
}

// ==================== 业务 key 常量 ====================

export const STORAGE_KEYS = {
  get PROFILE() { return userKey('studentProfile') },
  get PRACTICE() { return userKey('practiceState') },
  get PATH_PLAN() { return userKey('learningPathPlan') },
  get CURRENT_STAGE() { return userKey('currentPathStage') },
  // 全局 key（不隔离）
  USERS: 'users',
  CURRENT_USER: 'currentUser',
} as const
