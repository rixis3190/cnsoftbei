/**
 * rag-eval.test — RAG 评测（S4-7），全离线零额度
 *
 * 三块内容：
 * 1. 检索质量：Recall@{1,3,5} / MRR / NDCG，**按查询类型分开统计**。
 *    stem 类查询与块文本高度重合，指标天然虚高，只作「管道是否接通」的健康检查；
 *    paraphrase（手写口语化）才是检索质量的真实样本。
 * 2. 忠实度反例：构造「检索对但回答跑偏」与「检索错但回答碰巧对」，
 *    断言指标能区分这两种情况（否则忠实度就是个恒定 0.9 的摆设）。
 * 3. withRag / withoutRag 对照：**模拟对照**，不是真实模型输出，
 *    只验证度量方向与管道，不代表线上效果（结论必须这样表述）。
 *
 * 产物：test-results/rag-metrics.json
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import queryDataset from '../golden/rag-queries.json'
import { retrieve } from '../../src/rag/buildIndex'
import { retrieveForQuestion } from '../../src/rag/retriever'
import {
  formatChunksForPrompt,
  formatCitations,
  MAX_CHUNKS,
  MAX_CHUNK_CHARS,
  MAX_TOTAL_CHARS,
} from '../../src/rag/ragPrompts'
import { faithfulness, mrr, ndcgAtK, recallAtK, splitSentences, type RankedHit } from '../../src/rag/ragMetrics'
import { getIndex } from '../../src/rag/buildIndex'
import { scoreAnswer } from '../../src/services/answerScorer'
import { getGoldSet, loadGoldenSet } from '../golden/goldenSet'
import { RETRIEVAL_FLOOR, SEMANTIC_PASS_SCORE } from '../../src/config/qualityThresholds'

type QueryKind = 'stem' | 'paraphrase' | 'overview'
interface QueryItem {
  id: string
  query: string
  goldChunkIds: string[]
  goldTag?: string
  kind: QueryKind
  tags: string[]
}

const queries = queryDataset.queries as unknown as QueryItem[]
const golden = getGoldSet(loadGoldenSet().items)

/** 检索一次并转成指标需要的形状 */
function runRetrieval(query: string, tagHint?: string[]) {
  const hits = retrieve(query, { topK: 5, floor: 0, tagHint })
  return hits.map(h => ({ id: h.chunk.id, score: h.score })) as RankedHit[]
}

/**
 * 检索一次并转成指标需要的形状。
 * paraphrase 类没有唯一金标块（口语化提问对应「该标签下的任一块」），
 * 因此这里把该标签下的全部块作为 gold 集合，按 topK 截断后算命中。
 */
function retrievalFor(query: QueryItem): { retrieved: RankedHit[]; gold: string[] } {
  if (query.kind !== 'paraphrase') {
    return { retrieved: runRetrieval(query.query), gold: query.goldChunkIds }
  }
  const hint = query.goldTag ? [query.goldTag] : undefined
  const hits = retrieve(query.query, { topK: 5, floor: 0, tagHint: hint })
  // 金标集合必须与检索侧的过滤口径一致：检索用的是 `chunk.tags.some(t => hint.has(t))`，
  // 这里若只看 tags[0]，多标签块「能被召回却不算命中」，指标会被系统性低估（评审 MAJOR-5）。
  const gold = (getIndex()?.chunks ?? [])
    .filter(c => (hint ?? []).some(t => c.tags.includes(t)))
    .map(c => c.id)
  return { retrieved: hits.map(h => ({ id: h.chunk.id, score: h.score })), gold }
}

function metricsFor(items: QueryItem[], k: number) {
  const rows = items.map(q => {
    const { retrieved, gold } = retrievalFor(q)
    return {
      id: q.id,
      recall: gold.length ? recallAtK(retrieved, gold, k) : NaN,
      mrr: gold.length ? mrr(retrieved, gold, k) : NaN,
      ndcg: gold.length ? ndcgAtK(retrieved, gold, k) : NaN,
      top: retrieved[0]?.id ?? null,
    }
  })
  const valid = rows.filter(r => !Number.isNaN(r.recall))
  const mean = (key: 'recall' | 'mrr' | 'ndcg') =>
    valid.length === 0 ? 0 : valid.reduce((s, r) => s + r[key], 0) / valid.length
  return { rows, validCount: valid.length, recall: mean('recall'), mrr: mean('mrr'), ndcg: mean('ndcg') }
}

const stemMetrics = metricsFor(queries.filter(q => q.kind === 'stem'), 3)
const paraphraseMetrics = metricsFor(queries.filter(q => q.kind === 'paraphrase'), 3)
const overviewMetrics = metricsFor(queries.filter(q => q.kind === 'overview'), 3)

/**
 * 不带 tagHint 的 paraphrase 指标 = **与生产一致的调用路径**
 * （Tutor 调 `retrieveForQuestion(q, { topK: 3 })`，不传 tagHint）。
 * 带 hint 的那一份是「标签路由上限」，不带 hint 的才是真实检索质量。
 */
function metricsForNoHint(items: QueryItem[], k: number) {
  const rows = items.map(q => {
    const retrieved = runRetrieval(q.query)
    const gold = (getIndex()?.chunks ?? [])
      .filter(c => (q.goldTag ? [q.goldTag] : []).some(t => c.tags.includes(t)))
      .map(c => c.id)
    return { id: q.id, recall: gold.length ? recallAtK(retrieved, gold, k) : NaN }
  })
  const valid = rows.filter(r => !Number.isNaN(r.recall))
  return {
    validCount: valid.length,
    recall: valid.length === 0 ? 0 : valid.reduce((s, r) => s + r.recall, 0) / valid.length,
  }
}

const paraphraseNoHint = metricsForNoHint(queries.filter(q => q.kind === 'paraphrase'), 3)

describe('检索质量（按查询类型分开统计）', () => {
  it('stem 类：管道接通，Recall@3 ≥ 0.9（健康检查，非质量结论）', () => {
    expect(stemMetrics.validCount).toBe(83)
    expect(stemMetrics.recall).toBeGreaterThanOrEqual(0.9)
  })

  it('paraphrase 类（带 tagHint = 标签路由上限）：结果如实记录，不设虚假门禁', () => {
    // 金标集合是「该标签下的全部块」，而检索也用同一标签过滤 → 候选集 = gold 集合，
    // Recall@3 恒等于 min(3,|gold|)/|gold|，**不携带排序信息**。
    // 因此这一份只能读作「标签路由上限」，不能当检索质量结论。
    expect(paraphraseMetrics.validCount).toBe(22)
    expect(paraphraseMetrics.recall).toBeGreaterThan(0)
    expect(Number.isNaN(paraphraseMetrics.recall)).toBe(false)
  })

  it('paraphrase 类（不带 tagHint = 生产路径）：真实检索质量', () => {
    expect(paraphraseNoHint.validCount).toBe(22)
    expect(paraphraseNoHint.recall).toBeGreaterThan(0)
    // 不带 hint 的召回不会比带 hint 更高（hint 只会缩小候选集、提高命中密度）
    expect(paraphraseNoHint.recall).toBeLessThanOrEqual(paraphraseMetrics.recall + 1e-9)
  })

  it('overview 类：概览块能被概览型查询召回', () => {
    expect(overviewMetrics.validCount).toBe(43)
    expect(overviewMetrics.recall).toBeGreaterThan(0)
  })

  it('Recall@1 ≤ Recall@3 ≤ Recall@5（排序指标必须单调，否则计算有误）', () => {
    const at = (k: number, items: QueryItem[]) => metricsFor(items, k).recall
    const stems = queries.filter(q => q.kind === 'stem')
    expect(at(1, stems)).toBeLessThanOrEqual(at(3, stems))
    expect(at(3, stems)).toBeLessThanOrEqual(at(5, stems))
  })

  it('MRR ≤ 1 且 ≥ 0', () => {
    for (const m of [stemMetrics, paraphraseMetrics, overviewMetrics]) {
      expect(m.mrr).toBeLessThanOrEqual(1)
      expect(m.mrr).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('覆盖率与降级（计划 S4-R10）', () => {
  it('知识库覆盖率会被显式计算，而不是掩盖', () => {
    // 用 gold 条目的题干做查询，统计「有命中」的占比
    const covered = golden.filter(item => retrieve(item.question, { topK: 3, floor: 0 }).length > 0).length
    const ratio = covered / golden.length
    expect(ratio).toBeGreaterThan(0.9)
  })

  it('RAG_ENABLED=false 时 retrieveForQuestion 返回空数组（不注入上下文）', () => {
    const off = retrieveForQuestion('数据库事务隔离级别', { enabled: false })
    expect(off.chunks).toEqual([])
    expect(off.topScore).toBe(0)
  })

  it('开启后能拿到片段且按分数降序', () => {
    const on = retrieveForQuestion('数据库事务隔离级别有哪些', { enabled: true, floor: 0 })
    expect(on.chunks.length).toBeGreaterThan(0)
    for (let i = 1; i < on.chunks.length; i++) {
      expect(on.chunks[i - 1].score).toBeGreaterThanOrEqual(on.chunks[i].score)
    }
  })
})

describe('忠实度反例（混沌演练：指标必须能区分两种坏情况）', () => {
  const index = getIndex()!
  const goldItem = golden.find(item => item.bank === 'database')!
  const goldText = goldItem.referenceAnswer
  const unrelated = '今天天气不错，适合去公园散步，顺便买杯咖啡。'

  it('反例 A：检索对但回答跑偏 → 忠实度显著低于阈值', () => {
    const result = faithfulness(unrelated, [goldText], index.provider, 0.5)
    expect(result.score).toBeLessThan(0.5)
    expect(result.unsupported.length).toBe(result.totalSentences)
  })

  it('反例 B：检索错但回答碰巧对 → 对错误片段低、对正确片段高', () => {
    const wrongText = 'Java 的 HashMap 在 JDK8 之后用红黑树处理长链表。'
    const againstWrong = faithfulness(goldText, [wrongText], index.provider, 0.5)
    const againstRight = faithfulness(goldText, [goldText], index.provider, 0.5)
    expect(againstWrong.score).toBeLessThan(againstRight.score)
    // 已知局限（S4-R8）：单句 vs 整块文本的余弦并不等于 1，
    // 所以「完全正确的回答」忠实度也到不了 1.0，这里只要求明显高于错误检索的情形。
    expect(againstRight.score).toBeGreaterThan(0.6)
  })

  it('指标不是恒定值：好回答与坏回答差距明显', () => {
    const good = faithfulness(goldText, [goldText], index.provider, 0.5)
    const bad = faithfulness(unrelated, [goldText], index.provider, 0.5)
    expect(good.score - bad.score).toBeGreaterThan(0.5)
  })

  it('切句只按中文句号/问号/分号', () => {
    expect(splitSentences('第一句。第二句？第三句；第四句')).toEqual([
      '第一句',
      '第二句',
      '第三句',
      '第四句',
    ])
  })

  it('空回答不除零', () => {
    const result = faithfulness('', [goldText], index.provider, 0.5)
    expect(result.totalSentences).toBe(0)
    expect(result.score).toBe(0)
  })
})

describe('withRag / withoutRag 对照（模拟对照，非真实模型输出）', () => {
  it('有检索上下文时语义分更高', () => {
    const sample = golden.slice(0, 40)
    const withRag = sample.map(item =>
      scoreAnswer(item.anchors.excellent, item, { scorer: getIndex()!.provider }).total,
    )
    // 无检索时模型只能给出泛化回答：用 fair 锚点近似（它信息不全）
    const withoutRag = sample.map(item =>
      scoreAnswer(item.anchors.fair, item, { scorer: getIndex()!.provider }).total,
    )
    const avgWith = withRag.reduce((s, x) => s + x, 0) / withRag.length
    const avgWithout = withoutRag.reduce((s, x) => s + x, 0) / withoutRag.length
    expect(avgWith).toBeGreaterThan(avgWithout)
  })

  it('通过率指标在 excellent 档饱和、在 fair 档不饱和——阈值确有区分度（2026-10-08 复核口径）', () => {
    // 旧口径（阈值 61 + 模板锚点）：excellent 与 fair **都** 100% 通过，
    // 说明当时阈值对「好 / 中等」两档完全无区分度，这正是保持影子模式的理由。
    // 复核后（阈值 77 + curated 锚点）：excellent 仍贴顶（满分回答必然通过），
    // 但 fair 只有约 3/4 通过 —— 阈值现在能区分「完整回答」与「只答出一部分」。
    // 若将来有人改动阈值或数据集，这条断言会失败并提醒重新复核（不要静默漂移）。
    const sample = golden.slice(0, 40)
    const provider = getIndex()!.provider
    const passWith =
      sample.filter(i => scoreAnswer(i.anchors.excellent, i, { scorer: provider }).total >= SEMANTIC_PASS_SCORE)
        .length / sample.length
    const passWithout =
      sample.filter(i => scoreAnswer(i.anchors.fair, i, { scorer: provider }).total >= SEMANTIC_PASS_SCORE)
        .length / sample.length
    expect(passWith).toBe(1)
    expect(passWithout).toBeGreaterThan(0.5)
    expect(passWithout).toBeLessThan(passWith)
  })
})

describe('注入文本的长度上限（S4-R5 / DoD）', () => {
  it('片段数 ≤3、单片段 ≤300 字、总长 ≤1500 字', () => {
    const hits = retrieve('事务与索引', { topK: 20, floor: 0 })
    const formatted = formatChunksForPrompt(hits)
    expect(formatted.length).toBeGreaterThan(0)
    // 片段数守卫（曾经用 maxChunkChars 比较片个数，量纲错导致恒不触发）
    expect(formatted.length).toBeLessThanOrEqual(MAX_CHUNKS)
    let total = 0
    for (const c of formatted) {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 1)
      total += c.text.length
    }
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CHARS + 1)
  })

  it('truncated 标记在三种边界上都正确', () => {
    const chunkOf = (text: string) => ({
      chunk: {
        id: 'x',
        kind: 'question' as const,
        bank: 'python' as const,
        tags: ['python-syntax'],
        text,
        sourceQuestionId: 'q1',
        partIndex: 0,
        moduleId: 'module-1',
        type: 'short' as const,
        difficulty: 'easy' as const,
      },
      score: 1,
      cosine: 1,
      keyword: 1,
    })

    // ① 超限 → 置 true
    const long = formatChunksForPrompt([chunkOf('长'.repeat(MAX_CHUNK_CHARS + 50))])
    expect(long[0].truncated).toBe(true)
    expect(long[0].text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 1)

    // ② 恰好等于上限 → 不截断（这里就是旧实现漏报的边界）
    const exact = formatChunksForPrompt([chunkOf('长'.repeat(MAX_CHUNK_CHARS))])
    expect(exact[0].truncated).toBe(false)

    // ③ 单片段未超限但总预算放不下 → 置 true
    const many = formatChunksForPrompt(
      [
        chunkOf('甲'.repeat(MAX_CHUNK_CHARS)),
        chunkOf('乙'.repeat(MAX_CHUNK_CHARS)),
        chunkOf('丙'.repeat(MAX_CHUNK_CHARS)),
        chunkOf('丁'.repeat(MAX_CHUNK_CHARS)),
      ],
      { maxTotalChars: MAX_CHUNK_CHARS * 2 + 100 },
    )
    expect(many.length).toBeGreaterThan(2)
    const last = many[many.length - 1]
    expect(last.truncated).toBe(true)
    expect(many.reduce((s, c) => s + c.text.length, 0)).toBeLessThanOrEqual(MAX_CHUNK_CHARS * 2 + 101)
  })

  it('空检索结果 → 空数组（不注入任何占位文本）', () => {
    expect(formatChunksForPrompt([])).toEqual([])
    expect(formatCitations([])).toBe('')
  })

  it('引用编号从 1 连续递增', () => {
    const formatted = formatChunksForPrompt(retrieve('索引', { topK: 3, floor: 0 }))
    formatted.forEach((c, i) => expect(c.index).toBe(i + 1))
    expect(formatCitations(formatted)).toContain('[1]')
  })
})

describe('产出 rag-metrics.json', () => {
  it('报告含三类查询的分开统计与口径说明', async () => {
    const report = {
      generatedBy: 'tests/eval/rag-eval.test.ts',
      knowledgeBaseChunks: getIndex()?.chunks.length ?? 0,
      retrieval: {
        stem: { count: stemMetrics.validCount, recallAt3: stemMetrics.recall, mrr: stemMetrics.mrr, ndcgAt3: stemMetrics.ndcg },
        paraphrase: {
          count: paraphraseMetrics.validCount,
          recallAt3: paraphraseMetrics.recall,
          mrr: paraphraseMetrics.mrr,
          ndcgAt3: paraphraseMetrics.ndcg,
          noHintRecallAt3: paraphraseNoHint.recall,
        },
        // 注：不额外挂一个顶层 paraphraseNoHint 条目 —— 报告的表格是按
        // 「每个 key 都是一种检索类型」渲染的，混入不同结构的对象会让渲染崩掉。
        // 无 tagHint 的数值统一放在各类型的 noHintRecallAt3 字段里。
        overview: {
          count: overviewMetrics.validCount,
          recallAt3: overviewMetrics.recall,
          mrr: overviewMetrics.mrr,
          ndcgAt3: overviewMetrics.ndcg,
        },
      },
      /**
       * 降级可观测（计划 §1.3 硬性约束「任何降级都必须能在 eval-report 中看到」）：
       * 「无覆盖」= 该查询在**生产 floor** 下检索不到任何片段 → 生产路径不注入上下文（L3 降级）。
       *
       * 注意口径（评审 MAJOR-2）：必须走 `retrieveForQuestion` + `RETRIEVAL_FLOOR`，
       * 不能用 `retrieve(q, { floor: 0 })` —— 特征全为非负，floor=0 时任何非空查询必有命中，
       * 该数字会恒为 0，与它声称的「L3 生产语义」不符。
       */
      degradation: {
        noHitQueries: queries.filter(
          q => retrieveForQuestion(q.query, { enabled: true, topK: 3 }).chunks.length === 0,
        ).length,
        totalQueries: queries.length,
        retrievalFloor: RETRIEVAL_FLOOR,
        /** 模型层降级（L2）发生在运行期评审链路，本评测链路不经过它，故此处不统计 */
        modelDegradationNotInstrumented: true,
      },
      note:
        'stem 类召回率天然虚高（查询=题干，与块文本高度重合），只作健康检查；' +
        'paraphrase 类为手写口语化查询，金标集合是「该标签下全部块」，' +
        '故 Recall@3 的上限是 min(1, 3/金标块数)，不可与 stem 类横向比较；' +
        'withRag/withoutRag 为模拟对照（excellent vs fair 锚点），不是真实模型输出；' +
        '2026-10-08 复核后阈值 77 对 excellent 档饱和（100%）、对 fair 档不再饱和（约 70%），' +
        '即阈值化指标已能区分「完整回答」与「只答出一部分」；' +
        '检索降级（noHitQueries）按生产 floor 口径统计，模型层降级（L2）未接入本报告。',
    }
    const outDir = path.resolve(process.cwd(), 'test-results')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(path.join(outDir, 'rag-metrics.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    const saved = JSON.parse(readFileSync(path.join(outDir, 'rag-metrics.json'), 'utf8'))
    expect(saved.retrieval.stem.count).toBe(83)
    expect(saved.note).toContain('天然虚高')
    expect(saved.degradation.retrievalFloor).toBe(RETRIEVAL_FLOOR)
  })

  it('无覆盖统计对 floor 敏感（防止退回 floor=0 的口径）', async () => {
    // 背景：旧实现用 retrieve(q, { floor: 0 }) 统计「无覆盖」，
    // 而混合召回里余弦与 2-gram Jaccard 都非负 ⇒ 该数字恒为 0，
    // 却对外声称是「L3 生产语义」。本用例把「统计随 floor 变化」这件事钉住。
    //
    // 同时**如实记录一个已测量的既有缺陷**（不是本用例要修的东西）：
    // 当前固化 RETRIEVAL_FLOOR = 0.12 偏低，实测连无关查询都能过线，
    // 因此生产口径下的 noHitQueries = 0 是「floor 没挡住」而不是「知识库覆盖完美」。
    // 阈值重标定已登记 HANDOVER §13 B-28；在那之前不要把 0 读成高质量信号。
    //
    // 下面的断言把该缺陷的数值**钉在本用例里**（而不是写在小数注释里），
    // 使台账引用的数字可由测试自身复现。
    // ⚠️ 修 B-28（抬高 RETRIEVAL_FLOOR）时，最后一行 toBeGreaterThan(0) 需同步改为 0。
    const irrelevant = 'zzz qqq www 今天天气不错'
    const hitsAtZeroFloor = retrieve(irrelevant, { topK: 3, floor: 0 })
    expect(hitsAtZeroFloor.length).toBeGreaterThan(0)
    const topAtZeroFloor = hitsAtZeroFloor[0]?.score ?? 0
    // 生产 floor 挡不住它：分数高于固化 floor，却低于一个「真能挡住」的量级
    expect(topAtZeroFloor).toBeGreaterThan(RETRIEVAL_FLOOR)
    expect(topAtZeroFloor).toBeLessThan(0.3)
    // floor 必须真的参与过滤：抬高到 0.3 后同一条查询应被挡掉
    expect(retrieve(irrelevant, { topK: 3, floor: 0.3 }).length).toBe(0)
    // 低 floor 下（含当前生产值）这条查询仍会命中 —— 这正是上面记录的缺陷
    expect(retrieveForQuestion(irrelevant, { enabled: true, topK: 3 }).chunks.length).toBeGreaterThan(0)

    // 产物由同文件前一条用例写出（单跑本用例会缺文件）：失败时给出可诊断提示
    const { existsSync, readFileSync } = await import('node:fs')
    const reportPath = path.resolve(process.cwd(), 'test-results', 'rag-metrics.json')
    expect(
      existsSync(reportPath),
      'rag-metrics.json 缺失：请先运行「产出 rag-metrics.json」用例，或直接跑 npm run eval:rag',
    ).toBe(true)
    const saved = JSON.parse(readFileSync(reportPath, 'utf8'))
    expect(saved.degradation.totalQueries).toBe(queries.length)
    expect(saved.degradation.retrievalFloor).toBe(RETRIEVAL_FLOOR)
    // 口径守卫：报告里的计数必须等于「按生产 floor 现算」的条数。
    // 若哪天退回 floor=0 的统计口径，等 floor 真正起作用后这里会立刻不一致。
    const recount = queries.filter(
      q => retrieveForQuestion(q.query, { enabled: true, topK: 3 }).chunks.length === 0,
    ).length
    expect(saved.degradation.noHitQueries).toBe(recount)
  })
})

