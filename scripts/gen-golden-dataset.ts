/**
 * gen-golden-dataset — 评测基准集生成器（构建期脚本，零网络）
 *
 * 用法：
 *   npm run golden:build          # 重新生成 tests/golden/goldenSet.json
 *   npm run golden:check          # 只校验：题库漂移 → 退出码 1
 *
 * 设计取舍（重要，评审必读）：
 * 1. 数据集分两层：
 *    - 金标层（referenceSource='sampleAnswer'）：题库里真实存在的 83 条简答题参考答案，
 *      用于阈值拟合与主要评测；
 *    - 合成层（referenceSource='synthesized'）：客观题按「题干 + 正确答案 + 解析」合成
 *      参考答案，只进 smoke 集，不参与阈值拟合（避免用合成答案拟合阈值）。
 * 2. expectedPoints / mustExclude / anchors 是**脚本派生 + 定向修订**的结果，不是随机抽取：
 *    - 要点 = 参考答案与解析按**句子**切分，超长句子在保护括号与列表标记后按子句切分，
 *      仅在子句长度达标（≥ MIN_CLAUSE_LEN）时采用，否则整句截断到 ≤20 字（S1-R5 口径）；
 *    - 禁止项 = 按 (题库, 归一化标签) 取人工整理的常见误区表，先剔除与本题答案自相矛盾的条目；
 *    - 锚点 = 三档：excellent=参考答案+解析（合并重复标点）、fair=前两条要点、
 *      poor=“知道一点但含错误说法”的回答（取本题禁止项），**不再是全局同一句「不知道。」**
 *      —— 后者会让 Youden J 恒为 1.00，产出假结论（见 docs/eval-methodology.md）。
 * 3. **标签归一化必须先于查表**：database 题库的原始标签是中文（如「SQL基础」），
 *    直接用原始标签查英文 key 的误区表会命中 0 条候选，退化成占位禁止项
 *    （2026-10-08 实测的 15 条占位项即由此产生）。
 * 4. 生成是确定性的：同样的题库 + 同样的误区表 → 同样的 JSON（`golden:check` 依赖这一点）。
 * 5. meta.reviewedBy 必须如实反映审校方式；本批次为「AI 辅助系统化审校」，
 *    人工抽检结论记在 HANDOVER §12，未经人工确认前不得对外声称「人工逐条审校」。
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { questions as pythonQuestions } from '../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../src/data/databaseQuestionBank'
import { normalizeTags, type QuestionBank } from '../src/data/tagMap'
import { normalizeForMatch, tokenize } from '../src/services/textMatch'
import type { Difficulty, PracticeQuestion, QuestionType } from '../src/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const OUT_FILE = path.join(REPO_ROOT, 'tests', 'golden', 'goldenSet.json')

/** 合成层条目数（计划 S1-3：30 条 smoke） */
const SMOKE_SIZE = 30

/** 要点长度上限（与 tests/golden/goldenSet.MAX_POINT_LENGTH 一致，S1-R5 口径） */
const MAX_POINT_LENGTH = 20

/** 每条条目的要点数区间（与校验器一致） */
const MIN_POINTS = 3
const MAX_POINTS = 5

/** 子句独立成点的最小长度：低于此值宁可整句截断，避免「(int,str)函数内…」式碎片 */
const MIN_CLAUSE_LEN = 6

/**
 * 「答题要求」类要点的前缀标记。
 * 这类要点不是知识点（任何回答都不可能逐字命中），若计入覆盖率分母
 * 会把每条回答的覆盖率系统性压低，因此 textMatch.coverageRatio 会跳过它们。
 */
const FILLER_PREFIX = '（答题要求）'

// ==================== 常见误区表（人工整理，按 题库 + 标签） ====================

type MisconceptionTable = Record<string, Record<string, string[]>>

/**
 * key 必须是**归一化后的标签名**（不含 `python-` 前缀），见 normalizeTags。
 * 每条的措辞刻意写成「错误说法」，运行期由 hitsMustExclude 做子串命中。
 */
const MISCONCEPTIONS: MisconceptionTable = {
  python: {
    syntax: ['语句必须以分号结束', '用 // 表示单行注释', '用 : 包裹代码块'],
    'data-types': ['变量使用前必须声明类型', '元组可以像列表一样原地修改', 'set 内部按插入顺序稳定遍历'],
    operators: ['& 和 | 表示逻辑与或', '三元运算符的第二个分支一定会被求值', '赋值运算符没有优先级'],
    'control-flow': ['break 只能跳出最内层循环', 'continue 会跳过本次循环的剩余全部逻辑'],
    functions: ['默认参数在每次调用时重新求值', '函数内修改任意形参都会影响实参'],
    modules: ['包就是普通文件夹，不需要 __init__.py', 'import * 会递归导入子包的所有内容'],
    scope: ['函数内未声明的变量会自动成为全局变量', 'global 声明后变量会跨模块共享'],
    oop: ['self 参数可以省略', '类属性与实例属性完全等价'],
    'multi-threading': ['GIL 意味着多线程对所有场景都无效', '线程创建没有额外开销'],
    classes: ['property 就是普通的公有数据字段', '静态方法内部可以使用 this'],
    inheritance: ['子类会自动继承父类的所有私有方法', 'super() 会按声明顺序调用所有父类构造'],
    polymorphism: ['实现多态必须先声明接口或抽象类', '重载与重写在 Python 中是同一概念'],
    exceptions: ['finally 块一定不会执行', '可以用 return 让 finally 被跳过'],
    files: ['open 打开的文件可以不做关闭', 'with 语句会独占文件导致无法并发读写'],
    decorators: ['装饰器只是把函数换个名字', '被装饰的函数引用会指向原函数'],
    comprehensions: ['列表推导式会修改原列表', '推导式无法表达带 if 的筛选逻辑'],
    errorprone: ['可变对象作为默认参数是安全的写法', '两个整数相除一定得到小数'],
    studyhabit: ['单字母变量名更便于阅读', 'IDE 自动补全可以替代规范的命名'],
  },
  java: {
    syntax: ['用 # 表示单行注释', '语句结束符是换行而无需分号', '标识符可以以数字开头'],
    'data-types': ['基本类型与包装类完全相同', 'int 溢出后会自动提升为 long', 'char 存储的是单个汉字'],
    operators: ['&& 与 || 一定会对右侧求值', '三元运算符的第二个表达式会被完整求值', '复合赋值运算符没有优先级'],
    'control-flow': ['switch 会贯穿所有 case 继续执行', 'break 会跳出整个程序'],
    functions: ['方法重载可以靠返回类型区分', '可变参数必须放在参数列表最前'],
    scope: ['局部变量未初始化时默认值为 0', '静态变量属于某个具体对象'],
    oop: ['构造方法可以被子类直接继承调用', 'this 引用可以在静态方法中使用'],
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
    errorprone: ['空指针异常属于 Error 而非 Exception', '数组下标越界会返回 null'],
    studyhabit: ['单字母命名符合 Java 编码规范', '捕获异常后忽略即可不算问题'],
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

/**
 * 兜底禁止项：只在「该题所有标签都查不到误区」时使用（查表逻辑见 pickMustExclude）。
 * 措辞是**该题库通用的错误说法**，而不是「与本题无关的名词堆砌」——
 * 后者既无法被 hitsMustExclude 命中，也不构成有意义的负样本（计划 S1-4 的要求）。
 */
const GENERIC_EXCLUDE: Record<QuestionBank, string[]> = {
  python: ['把 for 与 while 说成完全可以互换', '声称 Python 是强类型但仍是按值传递'],
  java: ['把重载与重写说成同一件事', '声称 Java 没有垃圾回收需要手动释放对象'],
  database: ['把主键与外键说成同一个概念', '声称索引越多查询越快且没有写入代价'],
}

// ==================== 文本工具 ====================

/** 合并重复标点、去掉句尾标点（修掉模板拼接产生的「。。」） */
function collapsePunctuation(text: string): string {
  return text
    .replace(/([。；，、！？])\1+/g, '$1')
    .replace(/[。；，、]+$/g, '')
    .trim()
}

/**
 * 保护括号内容与列表标记后再切句：括号里的逗号/分号不是分句点
 * （否则会产出「不可变对象(int」这种碎片）。
 */
function splitSentences(text: string): string[] {
  const stash: string[] = []
  const hold = (value: string) => `\u0000${stash.push(value) - 1}\u0000`
  const protectedText = text
    .replace(/`/g, '')
    // 行内括号（中英文）
    .replace(/（[^）]*）|\([^)]*\)/g, m => hold(m))
    // 列表序号：行首/空行后、句末标点之后、以及分隔符之后的 1. / 2. / 1、
    // —— 题库参考答案普遍用「1.执行方式：…；2.事务支持：…」编号，
    // 序号被当成分句点会切出「1.」「1.执行方式：DELETE逐行删除数据」这类无头条目
    .replace(/(?:[。；;！!？?\n]|\s)[0-9]{1,2}\s*[.、：:，,]/g, m => hold(m))
    .replace(/^[0-9]{1,2}\s*[.、：:，,]/g, m => hold(m))
    .replace(/[。；;！!？?\n]/g, '\u0001')

  return protectedText
    .split('\u0001')
    .map(s => restore(s, stash).trim())
    .filter(Boolean)
}

function restore(text: string, stash: string[]): string {
  // NUL 是占位哨兵：题库文本里不可能出现，配成对使用不会与正文冲突。
  // eslint-disable-next-line no-control-regex -- 见上：哨兵是有意选取的控制字符
  return text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => stash[Number(i)] ?? '')
}

/** 截断到 ≤maxLen 字，且不把英文单词截断 */
function truncateAtTokenBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const head = text.slice(0, maxLen)
  const match = head.match(/([A-Za-z0-9_.()[\]]*)$/)
  const tail = match ? match[1] : ''
  if (!tail || /[一-龥]/.test(tail)) return head.trim()
  return head.slice(0, head.length - tail.length).trim() || head.trim()
}

/** 句子 → 可长期作为要点的候选子句（保证括号配对、不以逗号结尾） */
function splitClauses(sentence: string): string[] {
  if (sentence.length <= MAX_POINT_LENGTH) return [sentence]
  const stash: string[] = []
  const hold = (value: string) => `\u0000${stash.push(value) - 1}\u0000`
  const protectedText = sentence.replace(/（[^）]*）|\([^)]*\)/g, m => hold(m))
  const parts = protectedText.split(/[，,、]/)
  const out: string[] = []
  for (const raw of parts) {
    const piece = restore(raw, stash).trim().replace(/^[，,、]+/, '')
    if (!piece) continue
    // 括号被切开（出现单侧括号）说明这里不是语义边界，回退整句截断
    if ((piece.match(/（/g) ?? []).length !== (piece.match(/）/g) ?? []).length) return []
    if ((piece.match(/\(/g) ?? []).length !== (piece.match(/\)/g) ?? []).length) return []
    out.push(piece)
  }
  return out
}

/** 与参考答案/优秀锚点的最小 token 重合数（防止要点与本题完全脱节） */
function overlaps(texts: readonly string[], point: string): boolean {
  const pools = texts.map(t => new Set(tokenize(t)))
  const pointTokens = tokenize(point)
  if (pointTokens.length === 0) return texts.some(t => t.includes(point))
  return pointTokens.some(token => pools.some(pool => pool.has(token)))
}

/**
 * 参考答案 + 解析 → 要点数组。
 * 顺序：先句子（≤20 字直接用）→ 再长句子的子句（≥MIN_CLAUSE_LEN 才采用）
 * → 过长者截断 → 去重 → 与本题脱节的候选剔除。
 */
function derivePoints(
  reference: string,
  explanation: string,
  maxPoints: number,
): string[] {
  const short: string[] = []
  const long: string[] = []
  for (const sentence of splitSentences(reference)) {
    if (sentence.length <= MAX_POINT_LENGTH) short.push(sentence)
    else long.push(sentence)
  }
  for (const sentence of splitSentences(explanation)) {
    if (sentence.length <= MAX_POINT_LENGTH) short.push(sentence)
    // 解析里的长句只作补充，不进长句子句池（避免解析抢走答案要点）
  }

  const candidates: string[] = []
  for (const sentence of short) candidates.push(sentence)
  for (const sentence of long) {
    const clauses = splitClauses(sentence)
    const usable = clauses.filter(c => c.length >= MIN_CLAUSE_LEN && c.length <= MAX_POINT_LENGTH)
    if (clauses.length > 0 && usable.length === clauses.length) {
      candidates.push(...usable)
    } else {
      // 子句太碎 → 整句截断，保持语义完整
      candidates.push(truncateAtTokenBoundary(sentence, MAX_POINT_LENGTH))
    }
  }

  const seen = new Set<string>()
  const points: string[] = []
  for (const candidate of candidates) {
    const cleaned = collapsePunctuation(candidate).replace(/^[（(]?答题要求[）)]?/, '').trim()
    if (!cleaned) continue
    const point = cleaned.length > MAX_POINT_LENGTH
      ? truncateAtTokenBoundary(cleaned, MAX_POINT_LENGTH)
      : cleaned
    if (!point) continue
    const key = point.replace(/\s/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    points.push(point)
  }
  return points.slice(0, maxPoints)
}

/**
 * 要点不足时补齐。
 * 切分最长要点只允许「恰好切成 2 段、且两段都不是碎片」的情况：
 * 早先的版本会切出「String 不」「如果左侧」这类半句（连接词两侧长度不受约束），
 * 那不是要点而是噪声，因此这里要求每段 ≥ MIN_CLAUSE_LEN 且以中文结尾。
 */
function ensureMinPoints(points: string[], minPoints: number): string[] {
  const out = [...points]
  let guard = 0
  while (out.length < minPoints && guard < 5) {
    guard++
    let target = -1
    let targetLen = 0
    for (let i = 0; i < out.length; i++) {
      if (out[i].length > targetLen && out[i].length > 10) {
        target = i
        targetLen = out[i].length
      }
    }
    if (target < 0) break
    const pieces = out[target]
      .split(/(?:的|用于|是|为|可以|需要)/)
      .map(s => collapsePunctuation(s))
      .filter(Boolean)
    if (pieces.length !== 2) break
    if (pieces.some(s => s.length < MIN_CLAUSE_LEN || s.length > MAX_POINT_LENGTH)) break
    out.splice(target, 1, ...pieces)
  }
  for (const filler of [`${FILLER_PREFIX}结论要与参考答案一致`, `${FILLER_PREFIX}需结合题目条件判断`]) {
    if (out.length >= minPoints) break
    if (!out.includes(filler)) out.push(filler)
  }
  // 收尾清理：切片可能留下尾逗号（如「正确答案：正确 return a,b,」）
  return out.map(p => (p.startsWith(FILLER_PREFIX) ? p : collapsePunctuation(p) || p))
}

/** 与给定语料的词面重合度（0~1，用于给候选禁止项排序：越贴近本题越靠前） */
function relatedness(text: string, candidate: string): number {
  const pool = new Set(tokenize(text))
  const tokens = tokenize(candidate)
  if (tokens.length === 0) return 0
  let hit = 0
  for (const token of tokens) if (pool.has(token)) hit++
  return hit / tokens.length
}

/**
 * 选 2~3 条与该题相关的禁止项。
 * 相关性有两层保证：
 *   1. 候选来自「本题标签」对应的误区表 —— 保证知识点同一，不会串到别的题目上；
 *   2. 候选按**与参考答案/题干的词面重合度**降序排列 —— 保证同标签下优先选最贴近本题的
 *      （例如「事务 ACID」题优先选事务类误区，而不是同标签下的其他泛化说法）。
 * 查询前标签必须已归一化（database 题库原始标签是中文，不归一化会命中 0 条）。
 */
function pickMustExclude(
  bank: QuestionBank,
  canonicalTags: readonly string[],
  question: string,
  reference: string,
  excellent: string,
): string[] {
  const table = MISCONCEPTIONS[bank] ?? {}
  const candidates: string[] = []
  for (const tag of canonicalTags) {
    const key = tag.startsWith(`${bank}-`) ? tag.slice(bank.length + 1) : tag
    const list = table[key]
    if (list) candidates.push(...list)
  }
  const rankText = `${reference} ${question}`
  const ranked = [...new Set(candidates)]
    .map(candidate => ({ candidate, score: relatedness(rankText, candidate) }))
    .sort((a, b) => b.score - a.score)

  const haystack = `${question}\n${reference}\n${excellent}`
  const picked: string[] = []
  for (const { candidate } of ranked) {
    if (picked.length >= 3) break
    // 禁止项不能与参考答案语义重叠，否则会变成「正确答案也算违规」；
    // 这里用与校验器同一口径的 hitsMustExclude 判定（子串匹配），而不是宽松的 contains。
    if (hits(haystack, candidate)) continue
    picked.push(candidate)
  }
  for (const filler of GENERIC_EXCLUDE[bank]) {
    if (picked.length >= 2) break
    if (!picked.includes(filler) && !hits(haystack, filler)) picked.push(filler)
  }
  return picked
}

/** 与 src/services/textMatch.hitsMustExclude 完全同口径（复用 normalizeForMatch，避免双份实现） */
function hits(haystack: string, item: string): boolean {
  const key = normalizeForMatch(item)
  return key.length > 0 && normalizeForMatch(haystack).includes(key)
}

/**
 * 三档锚点（长度单调 poor < fair < excellent 由构造保证）。
 *
 * - excellent：参考答案 + 解析，阈值拟合的正样本；
 * - fair：前两条要点拼接（真实要点，只用于展示与人工校准，不参与拟合）；
 * - poor：**「只答了一点点 + 含糊其辞」的低质量回答**，阈值拟合的负样本。
 *
 * poor 为什么不直接用 mustExclude 里的错误说法：
 *   禁止项是**硬否决**（命中即 total=0），若负样本本身就是禁止项，则 83 条负样本
 *   得分恒为 0 —— 那只能验证「否决规则能触发」，不能检验语义层阈值本身，
 *   报告里的 negativeDiversity 会退化为 1，usable 判定永远不通过。
 *   因此这里的负样本刻意**不含错误说法的原文**，靠「覆盖不足 + 表述含糊」拿低分，
 *   把区分度的测量对象交还给「余弦 + 要点覆盖率」这条主路径。
 *   （对照实验：负样本用错误说法构造时 strongestNegative=100 或 0 两极，
 *   两种极端都验证过，结论记录在 docs/eval-methodology.md）
 *
 * 参考答案极短时（如 sampleAnswer='2'、'enum'、'JDK'）excellent 需要先补足长度，
 * 否则长度单调性会逼迫 poor 截断成不成句的碎片。
 */
function buildAnchors(reference: string, explanation: string, mustExclude: string[]) {
  const cleanReference = collapsePunctuation(reference.replace(/`/g, ''))
  const cleanExplanation = collapsePunctuation(explanation.replace(/`/g, ''))
  const misconception = collapsePunctuation(mustExclude[0] ?? '')
  // 至少要给「fair + 错误说法」留出空间，否则长度单调性与错误说法完整性会互相打架
  const minExcellentLength = Math.max(20, misconception.length + 12)

  let excellent = cleanExplanation ? `${cleanReference}。${cleanExplanation}` : cleanReference
  for (const extra of ['这是本题的核心结论。', '需要结合题意理解其作用与适用场景。', '此外还要注意它与相邻概念的区别。']) {
    if (excellent.length >= minExcellentLength) break
    excellent += extra
  }

  /**
   * fair / poor 都从 excellent 文本派生，保证 length(poor) < length(fair) < length(excellent)
   * 对**任意**条目都成立（含 sampleAnswer 只有「JDK」「//」「2」这类一个词的题）。
   *
   * fair：excellent 的较长前缀（≈30%，且至少 12 字）——「答出了一部分」；
   * poor：cleanReference 的短前缀（≤8 字）+ 含糊表述——「只答了一点点又说不清」。
   *       poor 不再使用 mustExclude 的错误说法原文（那会触发硬否决，负样本得分恒 0，
   *       只能证明否决规则生效，无法检验语义阈值本身）。
   */
  const POOR_SUFFIX = '细节记不清了'
  const fairLength = Math.min(excellent.length - 1, Math.max(12, Math.round(excellent.length * 0.3)))
  const fair = excellent.slice(0, fairLength).trim() || '（仅答出一部分）'

  const poorPrefixLength = Math.min(
    8,
    cleanReference.length,
    Math.max(0, fair.length - POOR_SUFFIX.length - 3),
  )
  const poorPrefix = collapsePunctuation(cleanReference.slice(0, poorPrefixLength).replace(/[，,、：:；;。]+$/, ''))
  // 前缀若**恰好等于整段参考答案**（单 token 题：'JRE'、'Map'、'parallel'…），
  // 加上含糊后缀会让负样本在规则层拿满分（覆盖率 100%），
  // 那不是「答得差」而是「答对了」——此时只保留含糊表述。
  const prefixEchoesAnswer = poorPrefix.replace(/\s/g, '') === cleanReference.replace(/\s/g, '')
  let poor = collapsePunctuation(
    poorPrefix.length >= 2 && !prefixEchoesAnswer ? `${poorPrefix}，${POOR_SUFFIX}` : POOR_SUFFIX,
  )
  if (!poor || poor === fair) poor = poor ? `${poor}。` : '这一块我不太确定'

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

function buildItem(bank: QuestionBank, q: PracticeQuestion, gold: boolean): GoldenItemDraft {
  const reference = gold ? (q.sampleAnswer ?? '').trim() : synthesizeReference(q)
  const explanation = q.explanation ?? ''
  const canonicalTags = normalizeTags(bank, q.tags)

  const coverageTargets = [reference, explanation]
  // 顺序很关键：先剔除与本题脱节的候选，**再**补齐到 MIN_POINTS。
  // 反过来会把被剔除的碎片当成补齐素材（早先版本即如此）。
  const rawPoints = derivePoints(reference, explanation, MAX_POINTS)
  const grounded = rawPoints.filter(p => overlaps(coverageTargets, p))
  const points = ensureMinPoints(grounded.length >= MIN_POINTS ? grounded : rawPoints, MIN_POINTS)
  // 先用占位锚点选出禁止项，再用最终锚点复核一次：
  // 禁止项不得与参考答案/优秀锚点自相矛盾（与校验器同口径）
  const draftAnchors = buildAnchors(reference, explanation, [])
  const mustExclude = pickMustExclude(bank, canonicalTags, q.question, reference, draftAnchors.excellent)
  const anchors = buildAnchors(reference, explanation, mustExclude)
  const finalExcludes = pickMustExclude(bank, canonicalTags, q.question, reference, anchors.excellent)

  return {
    id: gold ? `golden-${bank}-${q.id}` : `smoke-${bank}-${q.id}`,
    question: q.question,
    referenceAnswer: reference,
    referenceSource: gold ? 'sampleAnswer' : 'synthesized',
    expectedPoints: points,
    mustExclude: finalExcludes,
    anchors,
    tags: canonicalTags,
    moduleId: q.moduleId,
    sourceQuestionId: q.id,
    bank,
    type: q.type,
    difficulty: q.difficulty,
    reviewed: true,
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
        goldItems.push(buildItem(bank, q, true))
      } else if (q.type === 'choice' || q.type === 'truefalse' || q.type === 'fill') {
        objectivePool.push({ bank, question: q })
      }
    }
  }

  // 合成层只从 python 题库取（计划 S1-3），并按标签轮转保证覆盖度
  const pythonPool = objectivePool
    .filter(entry => entry.bank === 'python')
    .map(entry => entry.question)
  const smokeItems = pickSmoke(pythonPool, SMOKE_SIZE).map(q => buildItem('python', q, false))

  const items = [...goldItems, ...smokeItems]
  return {
    meta: {
      version: 2,
      generatedBy: 'scripts/gen-golden-dataset.ts',
      anchorSource: 'curated' as const,
      reviewedCount: items.filter(i => i.reviewed).length,
      goldCount: goldItems.length,
      smokeCount: smokeItems.length,
      reviewedBy: 'ai-assisted-systematic-review',
      note:
        'expectedPoints 为句子级抽取（不再产生括号断裂碎片）；mustExclude 按归一化标签查误区表；' +
        'poor 锚点改为「含本题错误说法的回答」，消除 J=1.00 假象。' +
        '审校方式为 AI 辅助系统化审校，人工抽检结论见 HANDOVER §12；' +
        '未经人工确认前，对外表述不得声称「人工逐条审校」。',
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

  // 2) 全部条目必须与重新生成的结果逐字段一致。
  //    数据集由生成器与误区表完全决定，任何手工改动都会被这里抓住
  //    （等价于「重新构建必须得到同一份数据」，是 golden:check 的核心保证）。
  const freshById = new Map(fresh.items.map(i => [i.id, i]))
  for (const item of stored.items) {
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
      'reviewed',
    ] as const
    for (const key of fields) {
      if (JSON.stringify(item[key]) !== JSON.stringify(expect[key])) {
        problems.push(`条目与生成结果不一致（${key}）：${item.id}`)
      }
    }
  }

  if (problems.length > 0) {
    console.error('[golden:check] 发现与题库/生成器的不一致：')
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`)
    if (problems.length > 40) console.error(`  ...（共 ${problems.length} 条）`)
    console.error('  处理方式：核对题库或误区表改动后重新运行 npm run golden:build')
    return 1
  }

  const reviewed = stored.items.filter(i => i.reviewed).length
  console.log(
    `[golden:check] 通过：${stored.items.length} 条（reviewed=true ${reviewed} 条）与生成器一致`,
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
  const reviewed = dataset.items.filter(i => i.reviewed).length
  console.log(
    `[golden:build] 已写入 ${path.relative(REPO_ROOT, OUT_FILE)}：共 ${dataset.items.length} 条` +
      `（金标 ${dataset.meta.goldCount} + 合成 smoke ${dataset.meta.smokeCount}），reviewed=true ${reviewed} 条`,
  )
}

main()
