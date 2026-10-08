/**
 * gen-golden-dataset — 评测基准集生成器（构建期脚本，零网络）
 *
 * 用法：
 *   npm run golden:build          # 重新生成 tests/golden/goldenSet.json
 *   npm run golden:check          # 只校验：题库漂移 / 未审校条目被改动 → 退出码 1
 *
 * 设计取舍（重要，评审必读）：
 * 1. 数据集分两层：
 *    - 金标层（referenceSource='sampleAnswer'）：题库里真实存在的 83 条简答题参考答案，
 *      用于阈值拟合与主要评测；
 *    - 合成层（referenceSource='synthesized'）：客观题按「题干 + 正确答案 + 解析」合成
 *      参考答案，只进 smoke 集，不参与阈值拟合（避免用合成答案拟合阈值）。
 * 2. expectedPoints / mustExclude / anchors 目前是**脚本派生初稿**：
 *    - 要点 = 参考答案按中文标点切分并压缩到 ≤20 字（与 S1-R5 的「单条要点 ≤20 字」一致）；
 *    - 禁止项 = 按 (题库, 标签) 取人工整理的常见误区表；
 *    - 锚点 = 模板派生（excellent=完整参考答案；fair=前两个要点；poor=笼统无信息量回答）。
 *    因此全部条目 reviewed=false，**阈值只能用于验证流程，不能作为最终指标**，
 *    人工审校（计划 S1-4）完成后才允许把结论写进简历。
 * 3. 生成是确定性的：同样的题库 → 同样的 JSON（`golden:check` 依赖这一点）。
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { questions as pythonQuestions } from '../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../src/data/databaseQuestionBank'
import { normalizeTags, type QuestionBank } from '../src/data/tagMap'
import type { Difficulty, PracticeQuestion, QuestionType } from '../src/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const OUT_FILE = path.join(REPO_ROOT, 'tests', 'golden', 'goldenSet.json')

/** 合成层条目数（计划 S1-3：30 条 smoke） */
const SMOKE_SIZE = 30

/**
 * 「答题要求」类要点的前缀标记。
 * 这类要点不是知识点（任何回答都不可能逐字命中），若计入覆盖率分母
 * 会把每条回答的覆盖率系统性压低，因此 textMatch.coverageRatio 会跳过它们。
 */
const FILLER_PREFIX = '（答题要求）'

// ==================== 常见误区表（人工整理，按 题库 + 标签） ====================

type MisconceptionTable = Record<string, Record<string, string[]>>

const MISCONCEPTIONS: MisconceptionTable = {
  python: {
    syntax: ['语句必须以分号结束', '用 // 表示单行注释', '用 : 包裹代码块'],
    'data-types': ['变量使用前必须声明类型', '元组可以像列表一样原地修改', 'set 内部按插入顺序稳定遍历'],
    operators: ['& 和 | 表示逻辑与或', '三元运算符的第二个分支一定会被求值', '赋值运算符没有优先级'],
    'control-flow': ['break 只能跳出最内层循环', 'continue 会跳过本次循环的剩余全部逻辑'],
    functions: ['默认参数在每次调用时重新求值', '函数内修改任意形参都会影响实参'],
    modules: ['包就是普通文件夹，不需要 __init__.py', 'import * 会递归导入子包的所有内容'],
    scope: ['函数内未声明的变量会自动成为全局变量', 'global 声明后变量会跨模块共享'],
    OOP: ['self 参数可以省略', '类属性与实例属性完全等价'],
    classes: ['property 就是普通的公有数据字段', '静态方法内部可以使用 this'],
    inheritance: ['子类会自动继承父类的所有私有方法', 'super() 会按声明顺序调用所有父类构造'],
    polymorphism: ['实现多态必须先声明接口或抽象类', '重载与重写在 Python 中是同一概念'],
    exceptions: ['finally 块一定不会执行', '可以用 return 让 finally 被跳过'],
    files: ['open 打开的文件可以不做关闭', 'with 语句会独占文件导致无法并发读写'],
    decorators: ['装饰器只是把函数换个名字', '被装饰的函数引用会指向原函数'],
    comprehensions: ['列表推导式会修改原列表', '推导式无法表达带 if 的筛选逻辑'],
    errorProne: ['可变对象作为默认参数是安全的写法', '两个整数相除一定得到小数'],
    studyHabit: ['单字母变量名更便于阅读', 'IDE 自动补全可以替代规范的命名'],
  },
  java: {
    syntax: ['用 # 表示单行注释', '语句结束符是换行而无需分号', '标识符可以以数字开头'],
    'data-types': ['基本类型与包装类完全相同', 'int 溢出后会自动提升为 long', 'char 存储的是单个汉字'],
    operators: ['&& 与 || 一定会对右侧求值', '三元运算符的第二个表达式会被完整求值', '复合赋值运算符没有优先级'],
    'control-flow': ['switch 会贯穿所有 case 继续执行', 'break 会跳出整个程序'],
    functions: ['方法重载可以靠返回类型区分', '可变参数必须放在参数列表最前'],
    scope: ['局部变量未初始化时默认值为 0', '静态变量属于某个具体对象'],
    OOP: ['构造方法可以被子类直接继承调用', 'this 引用可以在静态方法中使用'],
    classes: ['内部类无法访问外部类的私有成员', 'final 类仍然可以被继承'],
    inheritance: ['重写方法时必须先调用 super', 'Object 类没有任何方法'],
    polymorphism: ['向上转型后仍可访问子类特有方法', '接口不允许有 default 方法'],
    interfaces: ['接口里的字段是每个实现类各自的副本', '接口只能被继承而不能被实现'],
    exceptions: ['catch 之后 finally 一定不会执行', 'Throwable 只能由 Error 抛出'],
    collections: ['HashMap 允许存放 null 键并自动扩容', '用增强 for 循环删除元素不会抛异常'],
    generics: ['泛型在运行时仍会检查实际类型', 'List<Object> 可以直接赋值给 List<String>'],
    io: ['字节流与字符流可以混用而无需转换', 'BufferedReader 读完后不需要关闭'],
    multithreading: ['start 与 run 的效果完全相同', 'volatile 可以保证复合操作的原子性'],
    lambda: ['Lambda 捕获的局部变量必须是常量', 'Lambda 创建的匿名内部类可以被外部随意修改'],
    annotations: ['@Override 只是注释，可以省略', '@Retention 只影响文档，不影响运行期行为'],
    errorProne: ['空指针异常属于 Error 而非 Exception', '数组下标越界会返回 null'],
    studyHabit: ['单字母命名符合 Java 编码规范', '捕获异常后忽略即可不算问题'],
  },
  database: {
    fundamentals: ['外键约束一定会降低查询性能', '视图一定可以直接修改底层表数据'],
    'sql-basics': ['JOIN 一定返回所有参与表的全部行', 'HAVING 子句可以完全代替 WHERE 的功能', 'SQL 关键字大小写会影响语义'],
    constraints: ['添加约束后数据库会自动创建同名索引', 'NULL 与 NULL 比较结果是 TRUE'],
    transaction: ['读已提交级别可以防止脏写', '嵌套事务可以各自独立提交而不互相影响'],
    design: ['第三范式一定优于反范式设计', '一张表只能有一个主键约束'],
    index: ['索引越多写入性能越好', '建索引后所有查询都会变快'],
    'db-types': ['所有关系型数据库的 SQL 完全兼容', '关系型数据库不支持事务'],
    'multi-table-query': ['笛卡尔积的结果行数等于任一表的行数', '连接条件写在 WHERE 与写在 ON 上完全等价'],
    ops: ['只需要备份数据文件即可恢复', '删除日志文件不会影响故障恢复'],
  },
}

/** 三个题库没有误区配置的标签 → 兜底（仍与本题相关，不做无关名词堆砌） */
const GENERIC_EXCLUDE = ['与本题无关的其他技术名词', '明显偏离题意的实现方式']

// ==================== 工具函数 ====================

/** 参考答案 → 要点数组：中文标点切句 → 超长再按逗号切 → 压缩到 ≤maxLen 字 */
function derivePoints(text: string, maxLen: number, limit: number): string[] {
  const sentences = text
    .replace(/`/g, '')
    .split(/[。；;！!？?\n]/)
    .map(s => s.trim())
    .filter(Boolean)

  const clauses: string[] = []
  for (const sentence of sentences) {
    if (sentence.length <= maxLen) {
      clauses.push(sentence)
      continue
    }
    for (const part of sentence.split(/[，,、]/)) {
      const piece = part.trim()
      if (piece) clauses.push(piece)
    }
  }

  // 过短的子句（纯符号/单字母）单独成点没有区分度，尝试在其后再切一层
  const expanded: string[] = []
  for (const clause of clauses) {
    if (clause.length >= 4 || clause.length === 0) {
      expanded.push(clause)
      continue
    }
    // 极短子句（如 'JRE'）保留原样即可，它本身就是参考答案的核心内容
    expanded.push(clause)
  }

  const seen = new Set<string>()
  const points: string[] = []
  for (const clause of expanded) {
    const shortened = clause.length > maxLen ? truncateAtTokenBoundary(clause, maxLen) : clause
    const key = shortened.replace(/\s/g, '')
    if (!shortened || seen.has(key)) continue
    seen.add(key)
    points.push(shortened)
  }
  return points.slice(0, limit)
}

/**
 * 超长子句截断到 ≤maxLen 字，且不把英文单词截断
 * （截成 "if (obj instanceof S" 会让 "string" 这个词永远匹配不上）。
 */
function truncateAtTokenBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const head = text.slice(0, maxLen)
  // 结尾若是半截的英文/数字词（不含中文），回退到该词起点
  const match = head.match(/([A-Za-z0-9_.()[\]]*)$/)
  const tail = match ? match[1] : ''
  // 尾段含中文说明切在中文边界上，安全
  if (!tail || /[一-龥]/.test(tail)) return head.trim()
  return head.slice(0, head.length - tail.length).trim() || head.trim()
}

/** 要点不足 minPoints 时逐级补齐，保证标注下限（校验器要求 ≥3） */
function ensureMinPoints(points: string[], reference: string, minPoints: number): string[] {
  const out = [...points]
  let guard = 0
  // 1) 先把最长的要点再切一层（按「的 / 用于 / 是 / 为」这类连接处切）
  while (out.length < minPoints && guard < 5) {
    guard++
    let target = -1
    let targetLen = 0
    for (let i = 0; i < out.length; i++) {
      if (out[i].length > targetLen && out[i].length > 6) {
        target = i
        targetLen = out[i].length
      }
    }
    if (target < 0) break
    const pieces = out[target]
      .split(/(?:的|用于|是|为|可以|需要)/)
      .map(s => s.trim())
      .filter(s => s.length >= 4)
    if (pieces.length < 2) break
    out.splice(target, 1, ...pieces.slice(0, 2))
  }
  if (out.length >= minPoints) return out

  // 2) 参考答案整体作为一个兜底要点
  const whole = reference.replace(/`/g, '').slice(0, 20)
  if (whole && !out.includes(whole)) out.push(whole)
  // 3) 最后补「答题要求」式要点（不计入覆盖率分母，见 FILLER_PREFIX）
  for (const filler of [`${FILLER_PREFIX}结论要与参考答案一致`, `${FILLER_PREFIX}需结合题目条件判断`]) {
    if (out.length >= minPoints) break
    out.push(filler)
  }
  return out
}

/** 选 2~3 条与该题标签相关的禁止项，并剔除与题干/参考答案自相矛盾的条目 */
function pickMustExclude(
  bank: QuestionBank,
  rawTags: readonly string[],
  question: string,
  reference: string,
): string[] {
  const table = MISCONCEPTIONS[bank] ?? {}
  const candidates: string[] = []
  for (const tag of rawTags) {
    const list = table[tag]
    if (list) candidates.push(...list)
  }
  const haystack = `${question}\n${reference}`
  const picked: string[] = []
  for (const candidate of candidates) {
    if (picked.length >= 3) break
    if (picked.includes(candidate)) continue
    // 禁止项不能与参考答案语义重叠，否则会变成「正确答案也算违规」
    const key = candidate.replace(/[（(].*?[)）]/g, '')
    if (haystack.includes(key)) continue
    picked.push(candidate)
  }
  while (picked.length < 2) {
    const filler = GENERIC_EXCLUDE[picked.length % GENERIC_EXCLUDE.length]
    if (!picked.includes(filler)) picked.push(filler)
  }
  return picked
}

/**
 * 锚点：三档质量锚点，用于阈值拟合。
 * poor < fair < excellent 的长度单调性由构造保证（fair/excellent 不足时补齐说明性文字），
 * 断言见 tests/golden/goldenSet.test.ts。
 */
function buildAnchors(reference: string, explanation: string, points: string[]) {
  const poor = '不知道。'

  let fair = points.slice(0, 2).join('；')
  if (fair.length < 10) fair = `${fair}（其余细节暂不展开）`

  let excellent = explanation ? `${reference}。${explanation}` : `${reference}。`
  if (excellent.length <= fair.length) excellent = `${fair}。${excellent}`

  return { excellent, fair, poor }
}

interface GoldenItemDraft {
  id: string
  question: string
  referenceAnswer: string
  referenceSource: 'sampleAnswer' | 'synthesized'
  expectedPoints: string[]
  mustExclude: string[]
  anchors: { excellent: string; fair: string; poor: string }
  tags: string[]
  moduleId: string
  sourceQuestionId: string
  bank: QuestionBank
  type: QuestionType
  difficulty: Difficulty
  reviewed: boolean
}

/** 客观题的「正确答案」文本（choice / truefalse / fill 三选一） */
function objectiveAnswer(q: PracticeQuestion): string {
  if (q.type === 'truefalse') return q.trueFalseAnswer ? '正确' : '错误'
  if (q.type === 'fill') return q.fillAnswer ?? ''
  return q.correctAnswer ?? ''
}

/** 合成参考答案：正确答案 + 解析 */
function synthesizeReference(q: PracticeQuestion): string {
  const answer = objectiveAnswer(q)
  const parts = [`正确答案：${answer}`]
  if (q.explanation) parts.push(q.explanation)
  return parts.join(' ')
}

function buildGoldItem(bank: QuestionBank, q: PracticeQuestion): GoldenItemDraft {
  const reference = (q.sampleAnswer ?? '').trim()
  // 要点来源 = 参考答案 + 题库解析：java/database 有大量「答案只有一个符号」的简答题
  // （如 sampleAnswer='//'），只靠参考答案无法拆出 3 条要点，解析句才是有效信息。
  const pointSource = q.explanation ? `${reference}。${q.explanation}` : reference
  const points = ensureMinPoints(derivePoints(pointSource, 20, 5), reference, 3)
  return {
    id: `golden-${bank}-${q.id}`,
    question: q.question,
    referenceAnswer: reference,
    referenceSource: 'sampleAnswer',
    expectedPoints: points,
    mustExclude: pickMustExclude(bank, q.tags, q.question, reference),
    anchors: buildAnchors(reference, q.explanation ?? '', points),
    tags: normalizeTags(bank, q.tags),
    moduleId: q.moduleId,
    sourceQuestionId: q.id,
    bank,
    type: q.type,
    difficulty: q.difficulty,
    reviewed: false,
  }
}

function buildSmokeItem(bank: QuestionBank, q: PracticeQuestion): GoldenItemDraft {
  const reference = synthesizeReference(q)
  const points = ensureMinPoints(derivePoints(reference, 20, 5), reference, 3)
  return {
    id: `smoke-${bank}-${q.id}`,
    question: q.question,
    referenceAnswer: reference,
    referenceSource: 'synthesized',
    expectedPoints: points,
    mustExclude: pickMustExclude(bank, q.tags, q.question, reference),
    anchors: buildAnchors(reference, q.explanation ?? '', points),
    tags: normalizeTags(bank, q.tags),
    moduleId: q.moduleId,
    sourceQuestionId: q.id,
    bank,
    type: q.type,
    difficulty: q.difficulty,
    reviewed: false,
  }
}

/** 合成层选样：按标签轮转取样，保证 30 条覆盖尽可能多的标签，且完全确定性 */
function pickSmoke(pool: PracticeQuestion[], size: number): PracticeQuestion[] {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id))
  const byTag = new Map<string, PracticeQuestion[]>()
  for (const q of sorted) {
    for (const tag of q.tags) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag)!.push(q)
    }
  }
  const picked: PracticeQuestion[] = []
  const seen = new Set<string>()
  let guard = 0
  while (picked.length < size && guard < size * 50) {
    for (const list of byTag.values()) {
      const next = list.find(item => !seen.has(item.id))
      if (next) {
        seen.add(next.id)
        picked.push(next)
        if (picked.length >= size) break
      }
    }
    guard++
  }
  return picked.sort((a, b) => a.id.localeCompare(b.id))
}

function buildDataset() {
  const banks: { bank: QuestionBank; questions: PracticeQuestion[] }[] = [
    { bank: 'python', questions: pythonQuestions },
    { bank: 'java', questions: javaQuestions },
    { bank: 'database', questions: databaseQuestions },
  ]

  const goldItems: GoldenItemDraft[] = []
  const objectivePool: { bank: QuestionBank; question: PracticeQuestion }[] = []
  for (const { bank, questions } of banks) {
    for (const q of questions) {
      if (q.sampleAnswer) {
        goldItems.push(buildGoldItem(bank, q))
      } else if (q.type === 'choice' || q.type === 'truefalse' || q.type === 'fill') {
        objectivePool.push({ bank, question: q })
      }
    }
  }

  // 合成层只从 python 题库取（计划 S1-3），并按标签轮转保证覆盖度
  const pythonPool = objectivePool
    .filter(entry => entry.bank === 'python')
    .map(entry => entry.question)
  const smokeItems = pickSmoke(pythonPool, SMOKE_SIZE).map(q => buildSmokeItem('python', q))

  const items = [...goldItems, ...smokeItems]
  return {
    meta: {
      version: 1,
      generatedBy: 'scripts/gen-golden-dataset.ts',
      anchorSource: 'template',
      reviewedCount: items.filter(i => i.reviewed).length,
      goldCount: goldItems.length,
      smokeCount: smokeItems.length,
      note:
        'expectedPoints / mustExclude / anchors 为脚本派生初稿，reviewed=false；' +
        '阈值拟合仅用于验证流程，人工审校（计划 S1-4）后才可作为结论。',
    },
    items,
  }
}

// ==================== 校验模式 ====================

interface StoredDataset {
  meta: Record<string, unknown>
  items: GoldenItemDraft[]
}

function check(): number {
  if (!existsSync(OUT_FILE)) {
    console.error(`[golden:check] 缺少产物 ${path.relative(REPO_ROOT, OUT_FILE)}，请先运行 npm run golden:build`)
    return 1
  }
  const stored = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as StoredDataset
  const fresh = buildDataset()
  const problems: string[] = []

  // 1) 条目数量与 id 集合必须一致（题库删题/加题都会被抓到）
  const storedIds = new Set(stored.items.map(i => i.id))
  const freshIds = new Set(fresh.items.map(i => i.id))
  for (const id of freshIds) if (!storedIds.has(id)) problems.push(`题库新增条目未进数据集：${id}`)
  for (const id of storedIds) if (!freshIds.has(id)) problems.push(`数据集中存在题库已删除的条目：${id}`)

  // 2) 未审校条目必须与重新生成的初稿逐字段一致（人工改过 reviewed=true 的条目豁免）
  const freshById = new Map(fresh.items.map(i => [i.id, i]))
  for (const item of stored.items) {
    if (item.reviewed) continue
    const expect = freshById.get(item.id)
    if (!expect) continue
    const fields = [
      'question',
      'referenceAnswer',
      'expectedPoints',
      'mustExclude',
      'anchors',
      'tags',
      'difficulty',
      'moduleId',
    ] as const
    for (const key of fields) {
      if (JSON.stringify(item[key]) !== JSON.stringify(expect[key])) {
        problems.push(`未审校条目的 ${key} 与生成初稿不一致：${item.id}`)
      }
    }
  }

  if (problems.length > 0) {
    console.error('[golden:check] 发现与题库的漂移：')
    for (const p of problems) console.error(`  - ${p}`)
    console.error('  处理方式：核对题库改动后重新运行 npm run golden:build')
    return 1
  }

  console.log(
    `[golden:check] 通过：${stored.items.length} 条（其中 reviewed=true ${stored.items.filter(i => i.reviewed).length} 条）与题库一致`,
  )
  return 0
}

// ==================== 入口 ====================

function main() {
  if (process.argv.includes('--check')) {
    process.exit(check())
  }
  const dataset = buildDataset()
  writeFileSync(OUT_FILE, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
  console.log(
    `[golden:build] 已写入 ${path.relative(REPO_ROOT, OUT_FILE)}：共 ${dataset.items.length} 条` +
      `（金标 ${dataset.meta.goldCount} + 合成 smoke ${dataset.meta.smokeCount}），reviewed=true 0 条`,
  )
}

main()
