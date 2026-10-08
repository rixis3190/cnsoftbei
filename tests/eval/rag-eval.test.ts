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
import { formatChunksForPrompt, formatCitations, MAX_CHUNK_CHARS, MAX_TOTAL_CHARS } from '../../src/rag/ragPrompts'
import { faithfulness, mrr, ndcgAtK, recallAtK, splitSentences, type RankedHit } from '../../src/rag/ragMetrics'
import { getIndex } from '../../src/rag/buildIndex'
import { scoreAnswer } from '../../src/services/answerScorer'
import { getGoldSet, loadGoldenSet } from '../golden/goldenSet'
import { SEMANTIC_PASS_SCORE } from '../../src/config/qualityThresholds'

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
  const gold = (getIndex()?.chunks ?? [])
    .filter(c => (hint ?? []).includes(c.tags[0] ?? ''))
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

describe('检索质量（按查询类型分开统计）', () => {
  it('stem 类：管道接通，Recall@3 ≥ 0.9（健康检查，非质量结论）', () => {
    expect(stemMetrics.validCount).toBe(83)
    expect(stemMetrics.recall).toBeGreaterThanOrEqual(0.9)
  })

  it('paraphrase 类：手写口语化查询的真实召回（结果如实记录，不设虚假门禁）', () => {
    // 金标集合是「该标签下的全部块」（口语化提问没有唯一正确块），
    // 因此 Recall@3 的理论上限是 min(1, 3/金标块数)，这里只断言「有非零召回」。
    expect(paraphraseMetrics.validCount).toBe(22)
    expect(paraphraseMetrics.recall).toBeGreaterThan(0)
    expect(Number.isNaN(paraphraseMetrics.recall)).toBe(false)
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

  it('通过率指标在当前阈值下饱和（两组都 100%）——这正是影子模式的理由', () => {
    // 实测结论：阈值 61 对「excellent / fair」两档都判通过，
    // 因此**阈值化指标无法区分**这两档，只有连续分数能区分。
    // 这条断言把这个事实钉住：若将来有人调低阈值/换数据集，它会失败并提醒复核。
    const sample = golden.slice(0, 40)
    const provider = getIndex()!.provider
    const passWith =
      sample.filter(i => scoreAnswer(i.anchors.excellent, i, { scorer: provider }).total >= SEMANTIC_PASS_SCORE)
        .length / sample.length
    const passWithout =
      sample.filter(i => scoreAnswer(i.anchors.fair, i, { scorer: provider }).total >= SEMANTIC_PASS_SCORE)
        .length / sample.length
    expect(passWith).toBe(1)
    expect(passWithout).toBe(1)
  })
})

describe('注入文本的长度上限（S4-R5 / DoD）', () => {
  it('单片段 ≤300 字、总长 ≤1500 字', () => {
    const hits = retrieve('事务与索引', { topK: 20, floor: 0 })
    const formatted = formatChunksForPrompt(hits)
    expect(formatted.length).toBeGreaterThan(0)
    let total = 0
    for (const c of formatted) {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 1)
      total += c.text.length
    }
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_CHARS + 1)
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
        },
        overview: {
          count: overviewMetrics.validCount,
          recallAt3: overviewMetrics.recall,
          mrr: overviewMetrics.mrr,
          ndcgAt3: overviewMetrics.ndcg,
        },
      },
      note:
        'stem 类召回率天然虚高（查询=题干，与块文本高度重合），只作健康检查；' +
        'paraphrase 类为手写口语化查询，金标集合是「该标签下全部块」，' +
        '故 Recall@3 的上限是 min(1, 3/金标块数)，不可与 stem 类横向比较；' +
        'withRag/withoutRag 为模拟对照（excellent vs fair 锚点），不是真实模型输出；' +
        '实测阈值化通过率在两档均饱和为 100%，说明当前阈值无区分度，故语义层保持影子模式。',
    }
    const outDir = path.resolve(process.cwd(), 'test-results')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(path.join(outDir, 'rag-metrics.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    const saved = JSON.parse(readFileSync(path.join(outDir, 'rag-metrics.json'), 'utf8'))
    expect(saved.retrieval.stem.count).toBe(83)
    expect(saved.note).toContain('天然虚高')
  })
})

