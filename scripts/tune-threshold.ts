/**
 * tune-threshold — 语义层阈值标定（构建期脚本，零网络、零额度）
 *
 * 用法：
 *   npm run threshold:tune            # 标定并写 test-results/threshold-report.json
 *   npm run threshold:tune -- --check # 只比对已固化阈值是否仍接近最优（告警不阻断）
 *
 * 方法：
 * - 正样本 = 每条金标条目的 excellent 锚点；负样本 = poor 锚点（fair 永不参与，计划 S1-5）；
 * - 合成层（synthesized）不参与拟合（计划 T-1）；
 * - 逐阈值 0..1 步长 0.01 算 TPR/FPR/精确率/召回/F1/Youden J，取 J 最大点；
 * - LOO 交叉验证输出稳定性（计划 G-12：阈值取平坦区中心而非尖峰）；
 * - `usable=false` 时**建议保持影子模式**（计划 T3-1），此时脚本不会给出「可拦截」的结论。
 *
 * 脚本**不自动改** qualityThresholds.ts：阈值必须人工复核后手工固化（计划 S3-8）。
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import rawDataset from '../tests/golden/goldenSet.json'
import { scoreAnswer } from '../src/services/answerScorer'
import { getIndex } from '../src/rag/buildIndex'
import { SEMANTIC_PASS_SCORE, THRESHOLD_PROVENANCE } from '../src/config/qualityThresholds'
import { normalizeForMatch } from '../src/services/textMatch'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const OUT_DIR = path.join(REPO_ROOT, 'test-results')
const REPORT_JSON = path.join(OUT_DIR, 'threshold-report.json')
const REPORT_MD = path.join(OUT_DIR, 'threshold-report.md')

/** Youden J 低于此值视为「无区分度」，阈值不可用于拦截（计划 T3-1） */
const MIN_USABLE_YOUDEN_J = 0.3
/** LOO 折间阈值波动容差（±0.02 内视为稳定） */
const LOO_TOLERANCE = 0.02

interface GoldenRow {
  id: string
  bank: string
  tags: string[]
  positive: number
  negative: number
}

interface SweepPoint {
  threshold: number
  tpr: number
  fpr: number
  precision: number
  recall: number
  f1: number
  youdenJ: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * 阈值扫描。注意量纲：分数是 0~100，阈值也必须是 0~100（步长 1），
 * 与 qualityFunnel 的 `total < SEMANTIC_PASS_SCORE` 判定保持同一量纲。
 */
function sweep(positives: number[], negatives: number[]): SweepPoint[] {
  const points: SweepPoint[] = []
  const totalPos = positives.length
  const totalNeg = negatives.length
  for (let step = 0; step <= 100; step++) {
    const threshold = step
    const tp = positives.filter(s => s >= threshold).length
    const fp = negatives.filter(s => s >= threshold).length
    const tpr = totalPos === 0 ? 0 : tp / totalPos
    const fpr = totalNeg === 0 ? 0 : fp / totalNeg
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tpr
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
    points.push({
      threshold: Number(threshold.toFixed(2)),
      tpr: Number(tpr.toFixed(4)),
      fpr: Number(fpr.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      youdenJ: Number((tpr - fpr).toFixed(4)),
    })
  }
  return points
}

/** Youden J 的「平坦区中心」：取 J ≥ maxJ - 0.02 的区间中心，避免选到尖峰（G-12） */
function plateauCenter(points: SweepPoint[]): { threshold: number; youdenJ: number; width: number } {
  const maxJ = Math.max(...points.map(p => p.youdenJ))
  const flat = points.filter(p => p.youdenJ >= maxJ - 0.02)
  const first = flat[0]
  const last = flat[flat.length - 1]
  return {
    threshold: Number(((first.threshold + last.threshold) / 2).toFixed(1)),
    youdenJ: maxJ,
    width: Number((last.threshold - first.threshold).toFixed(1)),
  }
}

function build() {
  const index = getIndex()
  if (!index) {
    throw new Error('RAG 索引不可用，无法取得与线上一致的 idf；请先运行 npm run vectors:build')
  }

  const items = (rawDataset as { items: Record<string, unknown>[] }).items
  const gold = items.filter(
    i => i.referenceSource === 'sampleAnswer',
  ) as unknown as Parameters<typeof scoreAnswer>[1] & {
    id: string
    bank: string
    tags: string[]
    anchors: { excellent: string; fair: string; poor: string }
    expectedPoints: string[]
    mustExclude: string[]
    referenceAnswer: string
  }[]

  const rows: GoldenRow[] = gold.map(item => ({
    id: item.id,
    bank: item.bank,
    tags: item.tags,
    positive: scoreAnswer(item.anchors.excellent, item, { scorer: index.provider }).total,
    negative: scoreAnswer(item.anchors.poor, item, { scorer: index.provider }).total,
  }))

  const positives = rows.map(r => r.positive)
  const negatives = rows.map(r => r.negative)
  const points = sweep(positives, negatives)
  const plateau = plateauCenter(points)

  // LOO 交叉验证：每次留出一条，取剩余样本的最优阈值，再看该条判对没有
  const loo: { heldOut: string; threshold: number; correct: boolean }[] = []
  for (let i = 0; i < rows.length; i++) {
    const trainPos = positives.filter((_, idx) => idx !== i)
    const trainNeg = negatives.filter((_, idx) => idx !== i)
    const foldBest = plateauCenter(sweep(trainPos, trainNeg))
    const correct = rows[i].positive >= foldBest.threshold && rows[i].negative < foldBest.threshold
    loo.push({ heldOut: rows[i].id, threshold: foldBest.threshold, correct })
  }
  const stable = loo.filter(l => Math.abs(l.threshold - plateau.threshold) <= LOO_TOLERANCE).length
  const accuracy = loo.filter(l => l.correct).length / loo.length

  const posMedian = median(positives)
  const negMedian = median(negatives)
  const overlapping = negMedian >= posMedian
  // 负样本多样性：模板派生时所有 poor 锚点是同一句话，负样本不含真实区分信息
  const negativeDiversity = new Set(negatives.map(s => s.toFixed(4))).size
  const jOk = plateau.youdenJ >= MIN_USABLE_YOUDEN_J
  const reasons: string[] = []
  if (!jOk) reasons.push(`Youden J=${plateau.youdenJ} < ${MIN_USABLE_YOUDEN_J}`)
  if (overlapping) reasons.push('正负样本中位数重叠')
  if (negativeDiversity < Math.max(5, Math.floor(negatives.length / 10))) {
    reasons.push(`负样本只有 ${negativeDiversity} 种不同得分，区分信息不足`)
  }
  if (!THRESHOLD_PROVENANCE.humanReviewed) {
    reasons.push('锚点未人工审校（anchorSource=template），结论只能验证流程')
  }
  const usable = reasons.length === 0

  return {
    meta: {
      generatedBy: 'scripts/tune-threshold.ts',
      anchorSource: THRESHOLD_PROVENANCE.anchorSource,
      humanReviewed: THRESHOLD_PROVENANCE.humanReviewed,
      sampleSize: { positive: positives.length, negative: negatives.length },
      note:
        '锚点为脚本派生初稿时，本报告只能验证标定流程，' +
        '不能作为「该阈值可用于线上拦截」的依据（计划 T3-1 / S1-4）。',
    },
    result: {
      optimalThreshold: plateau.threshold,
      youdenJ: plateau.youdenJ,
      plateauWidth: plateau.width,
      tpr: points.find(p => p.threshold === plateau.threshold)?.tpr ?? 0,
      fpr: points.find(p => p.threshold === plateau.threshold)?.fpr ?? 0,
      positiveMedian: Number(posMedian.toFixed(2)),
      negativeMedian: Number(negMedian.toFixed(2)),
      scoreRange: { min: Math.min(...positives, ...negatives), max: Math.max(...positives, ...negatives) },
      mediansOverlap: overlapping,
      negativeDiversity,
      usable,
      usableReason: usable
        ? 'Youden J 达标、正负中位数可分、负样本有多样性且锚点已人工审校'
        : `${reasons.join('；')} → 建议保持影子模式（只记录不拦截）`,
    },
    loo: {
      folds: loo.length,
      accuracy: Number(accuracy.toFixed(4)),
      stableFolds: stable,
      stabilityRatio: Number((stable / loo.length).toFixed(4)),
      thresholds: loo.map(l => l.threshold),
    },
    sweep: points,
    rows,
  }
}

function toMarkdown(report: ReturnType<typeof build>): string {
  const lines: string[] = []
  lines.push('# 语义层阈值标定报告')
  lines.push('')
  lines.push(`- 样本：正 ${report.meta.sampleSize.positive} / 负 ${report.meta.sampleSize.negative}`)
  lines.push(`- 锚点来源：${report.meta.anchorSource}（人工复核：${report.meta.humanReviewed ? '是' : '否'}）`)
  lines.push(`- 最优阈值（Youden J 平原中心）：**${report.result.optimalThreshold}**，J=${report.result.youdenJ}（平原宽度 ${report.result.plateauWidth}）`)
  lines.push(`- TPR=${report.result.tpr} / FPR=${report.result.fpr}；正样本中位数=${report.result.positiveMedian}，负样本中位数=${report.result.negativeMedian}`)
  lines.push(`- LOO 交叉验证：${report.loo.folds} 折，准确率 ${report.loo.accuracy}，阈值落在 ±${LOO_TOLERANCE} 内的折数 ${report.loo.stableFolds}（${(report.loo.stabilityRatio * 100).toFixed(1)}%）`)
  lines.push(`- **usable=${report.result.usable}**：${report.result.usableReason}`)
  lines.push('')
  lines.push('| 阈值 | TPR | FPR | 精确率 | 召回 | F1 | Youden J |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const p of report.sweep) {
    if (p.threshold % 5 !== 0 && p.youdenJ < report.result.youdenJ) continue
    lines.push(`| ${p.threshold.toFixed(0)} | ${p.tpr} | ${p.fpr} | ${p.precision} | ${p.recall} | ${p.f1} | ${p.youdenJ} |`)
  }
  lines.push('')
  lines.push(report.meta.note)
  return `${lines.join('\n')}\n`
}

/** 标定主流程（导出供单测直接验证报告结构与不变量） */
export function tune(): ReturnType<typeof build> {
  return build()
}

export function main(): void {
  const report = build()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(REPORT_MD, toMarkdown(report), 'utf8')

  const suggested = Math.round(report.result.optimalThreshold)
  const current = SEMANTIC_PASS_SCORE
  const drift = Math.abs(suggested - current) / 100

  if (process.argv.includes('--check')) {
    console.log(
      `[threshold:check] 已固化 ${current} / 当前最优 ${suggested}（漂移 ${(drift * 100).toFixed(1)}%，容差 ±${LOO_TOLERANCE * 100}%）`,
    )
    if (drift > LOO_TOLERANCE) {
      // 计划 T3-R2：只告警不阻断，避免基准集微调导致门禁随机红
      console.warn(
        `[threshold:check] ⚠ 告警：已固化阈值与当前最优相差 ${(drift * 100).toFixed(1)}%，请复核 threshold-report.md 后手工更新 qualityThresholds.ts`,
      )
    }
    if (!report.result.usable) {
      console.warn(`[threshold:check] ⚠ 告警：${report.result.usableReason}`)
    }
    return
  }

  console.log(
    [
      `[threshold:tune] 样本 ${report.meta.sampleSize.positive}+${report.meta.sampleSize.negative}`,
      `[threshold:tune] 最优阈值 ${suggested}（Youden J=${report.result.youdenJ}，TPR=${report.result.tpr}，FPR=${report.result.fpr}）`,
      `[threshold:tune] LOO ${report.loo.folds} 折：准确率 ${report.loo.accuracy}，稳定折占比 ${(report.loo.stabilityRatio * 100).toFixed(1)}%`,
      `[threshold:tune] usable=${report.result.usable} —— ${report.result.usableReason}`,
      `[threshold:tune] 报告：${path.relative(REPO_ROOT, REPORT_JSON)} / ${path.relative(REPO_ROOT, REPORT_MD)}`,
      `[threshold:tune] 人工固化：把 SEMANTIC_PASS_SCORE 改为 ${suggested}（src/config/qualityThresholds.ts），并把 THRESHOLD_PROVENANCE.humanReviewed 置 true`,
      `[threshold:tune] 归一化口径自检：${normalizeForMatch('A，B').length} 字符（仅确认 textMatch 可用）`,
    ].join('\n'),
  )
  if (!existsSync(REPORT_JSON)) console.warn('[threshold:tune] 报告未写入')
}

// 仅在直接执行本脚本时跑 main()；被单测 import 时不自动执行
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
