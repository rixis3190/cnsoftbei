/**
 * gen-eval-report — 评测报告生成（构建期脚本，零网络）
 *
 * 沿用 gen-test-report.ts 的「纯字符串拼静态 HTML」范式，不引任何依赖。
 * 输入（都可选，缺哪个就少渲染哪块，不凭空造数）：
 *   test-results/golden-eval.json    基准集跑批
 *   test-results/threshold-report.json 阈值标定（含 ROC 表）
 *   test-results/rag-metrics.json     检索指标
 *   test-results/vectors-report.json  向量产物摘要（可选）
 *
 * 安全：题库与模型输出会进入 HTML，**全部文本必须转义**（计划 T5-R6）。
 *
 * 用法：npm run eval:report
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../test-results')
const OUTPUT = path.join(OUT_DIR, 'eval-report.html')

interface GoldenEval {
  summary: {
    mode: string
    sampleSize: number
    passRate: number
    avgScore: number
    separation: number | null
    confidence: string
    /** 要点全是「答题要求」填充项的条目数（覆盖率对这些条目无意义） */
    fillerOnlyItems?: number
    /** 降级计数（§1.3：任何降级都要能在报告里看到） */
    degradation?: {
      vetoedByMustExclude: number
      belowCoverageThreshold: number
    }
    /** 本轮候选来源（新产物才有；旧产物缺省时回退到 note 文字判断） */
    candidate?: 'poor' | 'excellent' | 'other'
    note: string
  }
  rows: { id: string; bank: string; coverage: number; ruleScore: number; rulePassed: boolean }[]
}

/** 降级演练产物（tests/eval/degradationDrill.test.ts 写出，B-27） */
interface DegradationDrill {
  generatedAt?: string
  drill: {
    l1SemanticFallback: { injected: number; flagged: number; behavior: string }
    l2ModelFallback: { injected: number; flagged: number; behavior: string; degradeScore?: number }
    l2BlockingSwitch: { injected: number; blocked: number; behavior: string }
  }
  note: string
}

interface ThresholdReport {
  result: {
    optimalThreshold: number
    youdenJ: number
    tpr: number
    fpr: number
    positiveMedian: number
    negativeMedian: number
    usable: boolean
    usableReason: string
  }
  loo: { folds: number; accuracy: number; stabilityRatio: number }
  sweep: { threshold: number; tpr: number; fpr: number; precision: number; recall: number; f1: number; youdenJ: number }[]
}

interface RagMetrics {
  knowledgeBaseChunks: number
  retrieval: Record<
    string,
    {
      count: number
      recallAt3: number
      mrr: number
      ndcgAt3: number
      /** 与生产一致（不传 tagHint）的 Recall@3；只有 paraphrase 类提供 */
      noHintRecallAt3?: number
    }
  >
  /** 降级计数：无覆盖查询（检索不到任何片段 → 不注入上下文） */
  degradation?: {
    noHitQueries: number
    totalQueries: number
    retrievalFloor?: number
    /** 模型层降级（L2）未接入报告时为 true —— 卡片会显式标注，避免读者以为「降级率 0」 */
    modelDegradationNotInstrumented?: boolean
  }
  note: string
}

function readJson<T>(file: string): T | null {
  const full = path.join(OUT_DIR, file)
  if (!fs.existsSync(full)) return null
  try {
    return JSON.parse(fs.readFileSync(full, 'utf-8')) as T
  } catch (error) {
    console.error(`⚠️ 读取 ${file} 失败：${(error as Error).message}`)
    return null
  }
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function card(num: string, label: string, tone = ''): string {
  return `<div class="card ${tone}"><div class="num">${escapeHtml(num)}</div><div class="label">${escapeHtml(label)}</div></div>`
}

function renderGolden(data: GoldenEval | null): string {
  if (!data) return '<p class="missing">未找到 golden-eval.json，请先运行 <code>npm run eval:golden</code></p>'
  const rows = [...data.rows].sort((a, b) => a.ruleScore - b.ruleScore).slice(0, 20)
  // 「负样本轮」的标注由产物自己声明，而不是无条件写死：
  // 一旦将来有 llm 轮或探路调用以默认参数（persist=true）落盘，
  // 无条件标题会把它的成绩标成「差锚点得分」—— 正是 §1.3 要防的静默误读。
  //
  // 判据优先取 `summary.candidate`（新产物显式携带的事实）；
  // 旧产物没有该字段时回退到 note 文字，且 note 缺失也不能崩（评审 MINOR-1）。
  const note = typeof data.summary.note === 'string' ? data.summary.note : ''
  const candidate = data.summary.candidate ?? (note.includes('负样本轮') ? 'poor' : 'other')
  const isNegativeRound = candidate === 'poor'
  // 注意：candidate 来自产物 JSON，必须转义后再进 HTML（本文件头部的安全契约，评审 MINOR-3）
  const roundTag = isNegativeRound ? ' · 负样本轮：候选 = poor 锚点' : ` · 候选来源 = ${escapeHtml(candidate)}`
  const roundNote = isNegativeRound
    ? `<p class="muted">本节的「通过率 / 平均分」是<strong>差锚点</strong>的得分，不是基准集上的模型成绩；
      excellent 轮的对应数字会贴顶（≈100%），对本报告没有信息量，故只落盘负样本轮。</p>`
    : candidate === 'other'
      ? `<p class="muted">本节<b>未声明候选来源</b>（产物缺 candidate 字段且 note 无标记）：
        请先确认这份 golden-eval.json 是哪一轮落盘的，再解读下面的数字。</p>`
      : `<p class="muted">本节候选来源 = ${escapeHtml(candidate)}（不是 poor 锚点），
        请勿把它当作「拒答能力」或降级观测读。</p>`
  return `
    <h2>基准集跑批（${escapeHtml(data.summary.mode)} 模式${roundTag}）</h2>
    ${roundNote}
    <div class="cards">
      ${card(String(data.summary.sampleSize), '样本量')}
      ${card(pct(data.summary.passRate), '规则层通过率', 'rate')}
      ${card(data.summary.avgScore.toFixed(1), '平均分')}
      ${card(data.summary.separation === null ? '—' : data.summary.separation.toFixed(1), '优秀-差 区分度', 'pass')}
      ${card(escapeHtml(data.summary.confidence), '置信度', 'skip')}
      ${card(String(data.summary.fillerOnlyItems ?? 0), '要点全为填充项', (data.summary.fillerOnlyItems ?? 0) > 0 ? 'skip' : '')}
    </div>
    <p class="note">${escapeHtml(note)}</p>
    <table>
      <thead><tr><th>条目</th><th>题库</th><th>覆盖率</th><th>规则分</th><th>通过</th></tr></thead>
      <tbody>
        ${rows
          .map(
            r => `<tr>
              <td>${escapeHtml(r.id)}</td>
              <td>${escapeHtml(r.bank)}</td>
              <td>${pct(r.coverage)}</td>
              <td>${r.ruleScore.toFixed(1)}</td>
              <td>${r.rulePassed ? '✅' : '❌'}</td>
            </tr>`,
          )
          .join('\n')}
      </tbody>
    </table>
    <p class="muted">（按规则分升序展示前 20 条，共 ${data.rows.length} 条）</p>`
}

function renderThreshold(data: ThresholdReport | null): string {
  if (!data) return '<p class="missing">未找到 threshold-report.json，请先运行 <code>npm run threshold:tune</code></p>'
  const rocRows = data.sweep
    .filter(p => p.threshold % 5 === 0 || Math.abs(p.threshold - data.result.optimalThreshold) < 0.6)
    .map(
      p => `<tr${Math.abs(p.threshold - data.result.optimalThreshold) < 0.6 ? ' class="highlight"' : ''}>
        <td>${p.threshold}</td><td>${p.tpr}</td><td>${p.fpr}</td>
        <td>${p.precision}</td><td>${p.recall}</td><td>${p.f1}</td><td><strong>${p.youdenJ}</strong></td>
      </tr>`,
    )
    .join('\n')
  return `
    <h2>阈值标定（ROC / Youden J）</h2>
    <div class="cards">
      ${card(String(data.result.optimalThreshold), '最优阈值', 'rate')}
      ${card(data.result.youdenJ.toFixed(3), 'Youden J')}
      ${card(`${data.result.tpr} / ${data.result.fpr}`, 'TPR / FPR')}
      ${card(`${data.loo.folds} 折`, 'LOO 交叉验证')}
      ${card(pct(data.loo.accuracy), 'LOO 准确率', 'pass')}
    </div>
    <p class="note ${data.result.usable ? 'ok' : 'warn'}">
      usable = <strong>${data.result.usable}</strong> —— ${escapeHtml(data.result.usableReason)}
    </p>
    <p class="muted">正样本中位数 ${data.result.positiveMedian} / 负样本中位数 ${data.result.negativeMedian}；
      阈值稳定性（±0.02 内的折占比）${pct(data.loo.stabilityRatio)}</p>
    <table>
      <thead><tr><th>阈值</th><th>TPR</th><th>FPR</th><th>精确率</th><th>召回</th><th>F1</th><th>Youden J</th></tr></thead>
      <tbody>${rocRows}</tbody>
    </table>`
}

/**
 * 降级可观测（计划 §1.3 的硬性约束）：
 * 「任何降级都必须能在 eval-report.html 中看到（降级率、触发次数），否则等于静默失效」。
 * 这里把三处来源汇总成一张卡片：规则层否决、覆盖率不达标、检索无覆盖。
 * 缺哪个来源就标「—」，不凭空造数。
 */
function renderDegradation(
  golden: GoldenEval | null,
  rag: RagMetrics | null,
  drill: DegradationDrill | null,
): string {
  const g = golden?.summary.degradation
  const r = rag?.degradation
  const total = golden?.summary.sampleSize ?? 0
  const rate = (value: number | undefined, denom: number) =>
    typeof value === 'number' && denom > 0 ? `${value} / ${denom}（${((value / denom) * 100).toFixed(1)}%）` : '—'
  const d = drill?.drill
  const drillRate = (flagged: number | undefined, injected: number | undefined) =>
    typeof flagged === 'number' && typeof injected === 'number' && injected > 0
      ? `${flagged} / ${injected}`
      : '—'
  /**
   * 演练是否全部被正确标记。
   * 三块**统一**用 `flagged === injected` 判定（评审 MINOR-5）：
   * 旧实现把 L1 写死成 `=== 1`，演练一旦扩到 2 条注入就会把「全过」误报成 warn；
   * 而阻塞开关那一格当时压根没参与判定，blocked=0 也会显示 ok。
   */
  const allFlagged = (flagged: number | undefined, injected: number | undefined) =>
    typeof flagged === 'number' && typeof injected === 'number' && injected > 0 && flagged === injected
  const drillAllFlagged =
    allFlagged(d?.l1SemanticFallback.flagged, d?.l1SemanticFallback.injected) &&
    allFlagged(d?.l2ModelFallback.flagged, d?.l2ModelFallback.injected) &&
    allFlagged(d?.l2BlockingSwitch.blocked, d?.l2BlockingSwitch.injected)
  // 金标两格的解读依赖轮次：只有负样本轮才有意义（评审 MINOR-2：这里要和基准集小节口径一致）
  // 三种状态必须分开：产物缺失 / 未声明来源 / 声明了非 poor 来源 —— 混为一谈会误导读者
  // （评审 MINOR-4：golden 缺失时不能显示「候选来源 = other」，那读起来像「跑过一轮 other」）
  const goldenCandidate = golden
    ? golden.summary.candidate ?? (String(golden.summary.note ?? '').includes('负样本轮') ? 'poor' : 'other')
    : null
  const goldenIsNegative = goldenCandidate === 'poor'
  return `
    <h2>降级可观测（§1.3）</h2>
    <div class="cards">
      ${card(rate(g?.vetoedByMustExclude, total), '规则层否决（禁止项命中）', 'skip')}
      ${card(rate(g?.belowCoverageThreshold, total), '覆盖率不达标（规则层）', 'skip')}
      ${card(
        r ? `${r.noHitQueries} / ${r.totalQueries}` : '—',
        `检索无覆盖（floor=${r?.retrievalFloor ?? '—'}）`,
        'skip',
      )}
      ${card(drillRate(d?.l1SemanticFallback.flagged, d?.l1SemanticFallback.injected), 'L1 语义层降级（演练）', 'skip')}
      ${card(drillRate(d?.l2ModelFallback.flagged, d?.l2ModelFallback.injected), 'L2 模型层降级（演练）', 'skip')}
      ${card(drillRate(d?.l2BlockingSwitch.blocked, d?.l2BlockingSwitch.injected), 'L2 阻塞开关生效（演练）', 'skip')}
    </div>
    <p class="muted">口径：规则层否决 = 答案命中禁止项（硬否决，total=0）；覆盖率不达标 = 要点覆盖率 &lt; 60%；
      检索无覆盖 = 该查询在生产 floor（${r?.retrievalFloor ?? '—'}）下无任何片段，生产路径按 L3 降级不注入上下文。
      ${goldenIsNegative
        ? '金标两格取自 <strong>golden-eval.json 的负样本轮</strong>（候选 = poor 锚点）—— excellent 轮的两项结构性恒为 0，不能用作降级观测。'
        : goldenCandidate === null
          ? '⚠️ 未找到 <strong>golden-eval.json</strong>：上面两格显示为「—」，本报告没有金标降级数据（请先运行 <code>npm run eval:golden</code>）。'
          : `⚠️ 金标两格的候选来源是 <strong>${escapeHtml(goldenCandidate)}</strong>，<b>不是负样本轮</b>：这两个数字此时不反映拒答能力，请勿用于降级观测。`}
      降级率长期为 0 且伴随低通过率时，应怀疑「降级分支根本没被走到」而不是「质量很好」。</p>
    ${drill
      ? `<p class="note ${drillAllFlagged ? 'ok' : 'warn'}">
      <strong>L1/L2 是演练结果，不是生产降级率</strong>（来源 degradation-drill.json，
      ${escapeHtml(String(drill.generatedAt ?? '未记录时间'))}）：
      注入 ${d?.l1SemanticFallback.injected ?? 0} 次语义层异常 → 标记 ${d?.l1SemanticFallback.flagged ?? 0} 次；
      注入 ${d?.l2ModelFallback.injected ?? 0} 次模型层失败 → 标记 ${d?.l2ModelFallback.flagged ?? 0} 次；
      阻塞开关注入 ${d?.l2BlockingSwitch.injected ?? 0} 次 → 其中 ${d?.l2BlockingSwitch.blocked ?? 0} 次按配置阻塞。
      它证明的是「降级分支存在且行为正确」，不是「线上降级了多少次」。
      ${r?.modelDegradationNotInstrumented ? '⚠️ 生产链路的 L1/L2 降级率**仍需运行期埋点**：当前只写 console，未进本报告。' : ''}
    </p>
    <p class="muted">${escapeHtml(String(drill.note ?? ''))}</p>`
      : '<p class="missing">未找到 degradation-drill.json，L1/L2 降级卡片缺失 —— 请运行 <code>npm run eval:drill</code>（它单独跑降级演练；<code>eval:golden</code> **不包含**演练）。</p>'}`
}

function renderRag(data: RagMetrics | null): string {
  if (!data) return '<p class="missing">未找到 rag-metrics.json，请先运行 <code>npm run eval:rag</code></p>'
  // 只渲染「结构完整的检索类型」条目：上游若混入其他形状的对象，
  // 这里跳过而不是崩溃（报告是构建期产物，不该因为一个字段缺失整条流水线失败）
  const rows = Object.entries(data.retrieval)
    .filter(
      ([, m]) =>
        typeof m?.count === 'number' &&
        typeof m?.recallAt3 === 'number' &&
        typeof m?.mrr === 'number' &&
        typeof m?.ndcgAt3 === 'number',
    )
    .map(([kind, m]) => {
      const noHint = m.noHintRecallAt3
      return `<tr>
        <td>${escapeHtml(kind)}</td>
        <td>${m.count}</td>
        <td>${m.recallAt3.toFixed(3)}</td>
        <td>${typeof noHint === 'number' ? noHint.toFixed(3) : '—'}</td>
        <td>${m.mrr.toFixed(3)}</td>
        <td>${m.ndcgAt3.toFixed(3)}</td>
      </tr>`
    })
    .join('\n')
  return `
    <h2>RAG 检索指标</h2>
    <div class="cards">
      ${card(String(data.knowledgeBaseChunks), '知识库块数')}
    </div>
    <table>
      <thead><tr><th>查询类型</th><th>样本</th><th>Recall@3</th><th>Recall@3（无 tagHint=生产路径）</th><th>MRR</th><th>NDCG@3</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">${escapeHtml(data.note)}</p>`
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #f5f5f5; color: #333; padding: 24px; }
  .container { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  h2 { font-size: 18px; margin: 28px 0 12px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .card { background: #fff; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .card .num { font-size: 24px; font-weight: 700; }
  .card .label { font-size: 12px; color: #888; margin-top: 4px; }
  .card.pass .num { color: #22c55e; }
  .card.fail .num { color: #ef4444; }
  .card.skip .num { color: #f59e0b; }
  .card.rate .num { color: #3b82f6; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 12px; }
  th { background: #f8f9fa; text-align: left; padding: 10px 14px; font-size: 13px; color: #666; border-bottom: 1px solid #eee; }
  td { padding: 8px 14px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  tr.highlight > td { background: #eff6ff; }
  .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 13px; color: #92400e; margin-bottom: 12px; }
  .note.ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  .note.warn { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  .muted { color: #888; font-size: 12px; }
  .missing { background: #fff; border: 1px dashed #ddd; border-radius: 8px; padding: 16px; color: #888; font-size: 13px; }
  code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .footer { text-align: center; color: #aaa; font-size: 12px; margin-top: 32px; }
`

function main(): void {
  const golden = readJson<GoldenEval>('golden-eval.json')
  const threshold = readJson<ThresholdReport>('threshold-report.json')
  const rag = readJson<RagMetrics>('rag-metrics.json')
  const drill = readJson<DegradationDrill>('degradation-drill.json')

  if (!golden && !threshold && !rag && !drill) {
    console.error('❌ 没有任何评测产物。请先运行：npm run eval:golden / threshold:tune / eval:rag')
    process.exit(1)
  }

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>评测报告 — 学习智能体系统</title>
<style>${STYLES}</style>
</head>
<body>
<div class="container">
  <h1>📊 评测报告 — 学习智能体系统</h1>
  <p class="meta">生成时间：${escapeHtml(now)} ｜ 默认离线运行，零 API 额度</p>
  ${renderGolden(golden)}
  ${renderThreshold(threshold)}
  ${renderDegradation(golden, rag, drill)}
  ${renderRag(rag)}
  <div class="footer">自动生成 · 指标口径见 docs/eval-methodology.md</div>
</div>
</body>
</html>`

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT, html, 'utf-8')
  console.log(`✅ 评测报告已生成: ${OUTPUT}`)
  console.log(
    `   基准集 ${golden ? `${golden.summary.sampleSize} 条` : '缺失'} ｜ 阈值 ${threshold ? threshold.result.optimalThreshold : '缺失'} ｜ 检索 ${rag ? '已生成' : '缺失'}`,
  )
}

main()


