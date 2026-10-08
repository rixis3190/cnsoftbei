/**
 * tagMap — 题库标签归一化（三个题库的唯一 tag 命名空间）
 *
 * 背景：三个题库各自维护 tags，python / java 共用了 syntax、data-types 等同名标签，
 * database 题库则直接用中文标签。若不归一化，跨题库统计与 RAG 检索都会串味。
 *
 * 规则：归一化标签 = `<bank>-<slug>`，slug 一律小写、ASCII（中文标签在此映射），
 * 因此语料与向量产物中不会出现原始中文标签（断言见 tests/unit/ragCorpus.test.ts）。
 */

export type QuestionBank = 'python' | 'java' | 'database'

/** 各题库统一用 bank 名做前缀，模块 id（module-1..n）保持原样 */
export const BANK_PREFIX: Record<QuestionBank, string> = {
  python: 'python',
  java: 'java',
  database: 'database',
}

/** database 题库的中文标签 → ASCII slug（python / java 的标签本身已是 ASCII） */
const DATABASE_TAG_SLUG: Record<string, string> = {
  数据库基础: 'fundamentals',
  SQL基础: 'sql-basics',
  数据库约束: 'constraints',
  数据库事务: 'transaction',
  数据库设计: 'design',
  数据库索引: 'index',
  数据库类型: 'db-types',
  多表查询: 'multi-table-query',
  数据库运维: 'ops',
}

/** 归一化标签的中文显示名（报告与提示词里用，避免直接把英文 slug 暴露给用户） */
const SLUG_TO_CHINESE: Record<string, string> = {
  fundamentals: '数据库基础',
  'sql-basics': 'SQL 基础',
  constraints: '数据库约束',
  transaction: '数据库事务',
  design: '数据库设计',
  index: '数据库索引',
  'db-types': '数据库类型',
  'multi-table-query': '多表查询',
  ops: '数据库运维',
  io: 'IO 流',
  oop: '面向对象',
  errorprone: '易错点',
  'multi-threading': '多线程',
}

/**
 * 归一化单个标签。
 * 已知标签走映射表；**未映射的中文标签**用 FNV-1a 哈希生成稳定 ascii slug
 * （如 `tag-1a2b3c4d`）—— 既不丢数据，也不让原始中文标签泄漏进语料与向量产物。
 */
export function normalizeTag(bank: QuestionBank, tag: string): string {
  const raw = tag.trim()
  if (!raw) return ''
  const slug = bank === 'database' ? (DATABASE_TAG_SLUG[raw] ?? raw) : raw
  let ascii = slug
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  if (!ascii) {
    // 非 ASCII 且未映射 → 稳定哈希 slug
    let hash = 0x811c9dc5
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i)
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
    }
    ascii = `tag-${hash.toString(16)}`
  }
  return `${BANK_PREFIX[bank]}-${ascii}`
}

/** 归一化标签数组：去空、去重、保持原有顺序 */
export function normalizeTags(bank: QuestionBank, tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const normalized = normalizeTag(bank, tag)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      out.push(normalized)
    }
  }
  return out
}

/** 取归一化标签的中文显示名；无映射时回退为 slug 本身 */
export function tagLabel(normalizedTag: string): string {
  const slug = normalizedTag.includes('-')
    ? normalizedTag.slice(normalizedTag.indexOf('-') + 1)
    : normalizedTag
  return SLUG_TO_CHINESE[slug] ?? slug
}

/** 题库的中文名（用户提问与语料正文都用它，而不是英文 slug） */
export const BANK_LABEL: Record<QuestionBank, string> = {
  python: 'Python',
  java: 'Java',
  database: '数据库',
}

export function bankLabel(bank: QuestionBank): string {
  return BANK_LABEL[bank]
}
