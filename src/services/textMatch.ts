/**
 * textMatch — 文本归一化与要点覆盖度计算（纯函数，无副作用）
 *
 * 基准集校验（tests/golden）、答案打分（src/services/answerScorer）、
 * 检索关键词通道共用同一套口径，避免「校验用一套算法、打分用另一套」导致阈值失真。
 */

/**
 * 归一化：把 markdown 反引号、空白与标点统一替换成**空格分隔符**后压缩。
 *
 * 注意：这里必须替换而不是删除 —— 直接删除会让相邻的英文单词粘连
 * （"throw。throw new Exception()" → "throwthrownewexception"），
 * 英文词表整个失效，要点覆盖率恒为 0。
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[`\s\u3000]/g, ' ')
    .replace(/[，。、；：？！“”‘’（）()《》【】[\]{}<>,.;:?!'"~—\-_/\\|*+=$#@%^&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * 切词：英文/数字按连续串切一个词，中文按单字切。
 * 中文按单字切是刻意的：中文没有空格，按字判断「覆盖了哪些知识点」更稳定。
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeForMatch(text)
  const tokens: string[] = []
  let buffer = ''
  for (const ch of normalized) {
    if (/[a-z0-9]/.test(ch)) {
      buffer += ch
      continue
    }
    if (buffer) {
      tokens.push(buffer)
      buffer = ''
    }
    if (/[一-龥]/.test(ch)) tokens.push(ch)
  }
  if (buffer) tokens.push(buffer)
  return tokens
}

/**
 * 单条要点被候选答案覆盖的比例（0~1）。
 * 判定方式：要点切词后，出现在候选答案中的词数 / 要点总词数。
 *
 * 纯符号要点（如 sampleAnswer='//'、'{}'、'=='）切词后为空，
 * 此时退回「归一化后子串包含」判定 —— 这类要点的正确答案必然包含该符号，
 * 若按空词表算 0 分会把所有回答的覆盖率系统性压低。
 *
 * **注意 `candidateRaw`**：归一化会把纯标号要点（`>>`、`//`、`{}`、`==`…）清成空串，
 * 此时若返回 1（"空要点视为已覆盖"），任何回答——包括空回答——都能白拿满分
 * （实测 `scoreAnswer('', 单符号题).total === 100`；回归守卫见 `tests/eval/runGoldenEval.test.ts` 的「空回答不得白拿分数」用例）。
 * 因此这类要点改为对**原文**做子串判定：包含才算覆盖，不含则为 0。
 */
export function pointCoverage(
  point: string,
  candidateTokens: ReadonlySet<string>,
  candidateNormalized = '',
  candidateRaw = '',
): number {
  const tokens = tokenize(point)
  if (tokens.length === 0) {
    const key = normalizeForMatch(point)
    if (!key) {
      // 纯标号要点：标号本身在归一化后消失，只能对原文比对。
      // 空白要点必须前置拦掉 —— 否则 `includes('')` 恒为 true，
      // 等于又退化成「空要点视为已覆盖」（校验器会拦数据集，但本函数是公共工具）。
      if (!point.trim()) return 0
      return candidateRaw.includes(point.trim()) ? 1 : 0
    }
    return candidateNormalized.includes(key) ? 1 : 0
  }
  let hit = 0
  for (const token of tokens) {
    if (candidateTokens.has(token)) hit++
  }
  return hit / tokens.length
}

/** 「答题要求」类要点前缀：不是知识点，不计入覆盖率分母（见 scripts/gen-golden-dataset.ts） */
export const FILLER_POINT_PREFIX = '（答题要求）'

/** 过滤出真正参与覆盖率计算的知识点 */
export function scorablePoints(points: readonly string[]): string[] {
  return points.filter(p => !p.trim().startsWith(FILLER_POINT_PREFIX))
}

/** 批量计算一组要点的平均覆盖率（跳过「答题要求」类要点） */
export function coverageRatio(points: readonly string[], candidate: string): number {
  const scorable = scorablePoints(points)
  if (scorable.length === 0) return 0
  const candidateTokens = new Set(tokenize(candidate))
  const candidateNormalized = normalizeForMatch(candidate)
  let total = 0
  for (const point of scorable) {
    total += pointCoverage(point, candidateTokens, candidateNormalized, candidate)
  }
  return total / scorable.length
}

/** 候选答案命中的禁止项（子串匹配；禁止项本身是「错误说法」而非关键词） */
export function hitsMustExclude(answer: string, mustExclude: readonly string[]): string[] {
  const normalized = normalizeForMatch(answer)
  return mustExclude.filter(item => {
    const key = normalizeForMatch(item)
    return key.length > 0 && normalized.includes(key)
  })
}
