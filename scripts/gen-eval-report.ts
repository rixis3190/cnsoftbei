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
    note: string
  }
  rows: { id: string; bank: string; coverage: number; ruleScore: number; rulePassed: boolean }[]
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
  retrieval: Record<string, { count: number; recallAt3: number; mrr: number; ndcgAt3: number }>
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
  return `
    <h2>基准集跑批（${escapeHtml(data.summary.mode)} 模式）</h2>
    <div class="cards">
      ${card(String(data.summary.sampleSize), '样本量')}
      ${card(pct(data.summary.passRate), '规则层通过率', 'rate')}
      ${card(data.summary.avgScore.toFixed(1), '平均分')}
      ${card(data.summary.separation === null ? '—' : data.summary.separation.toFixed(1), '优秀-差 区分度', 'pass')}
      ${card(escapeHtml(data.summary.confidence), '置信度', 'skip')}
    </div>
    <p class="note">${escapeHtml(data.summary.note)}</p>
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

function renderRag(data: RagMetrics | null): string {
  if (!data) return '<p class="missing">未找到 rag-metrics.json，请先运行 <code>npm run eval:rag</code></p>'
  const rows = Object.entries(data.retrieval)
    .map(
      ([kind, m]) => `<tr>
        <td>${escapeHtml(kind)}</td>
        <td>${m.count}</td>
        <td>${m.recallAt3.toFixed(3)}</td>
        <td>${m.mrr.toFixed(3)}</td>
        <td>${m.ndcgAt3.toFixed(3)}</td>
      </tr>`,
    )
    .join('\n')
  return `
    <h2>RAG 检索指标</h2>
    <div class="cards">
      ${card(String(data.knowledgeBaseChunks), '知识库块数')}
    </div>
    <table>
      <thead><tr><th>查询类型</th><th>样本</th><th>Recall@3</th><th>MRR</th><th>NDCG@3</th></tr></thead>
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

  if (!golden && !threshold && !rag) {
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


