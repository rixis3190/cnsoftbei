/**
 * check-workflow — GitHub Actions 工作流的**上下文合法性**静态自检（零依赖、零网络）
 *
 * 为什么需要它（2026-10-08 血泪，见 HANDOVER §10.4 / §11.13）：
 * `secrets` 违规出现在 `if:` 里时，**本地 YAML 解析完全正常，`npm run lint` 也不报**，
 * 但 GitHub 会在解析期拒绝整份工作流 —— 表现为「一次运行、0 个 job、无日志、直接 Failure」。
 * 这类错误只有推送后才发现，代价高（一次推送 + 一轮排查）。本脚本把它提前到本地。
 *
 * 规则来源：GitHub Docs → Contexts → Context availability
 *   jobs.<job_id>.if        : github / needs / vars / inputs
 *   jobs.<job_id>.steps.if  : 上述 + strategy / matrix / job / runner / env / steps
 *   secrets 只可用于**赋值位置**（env / with 等），**任何 if 里都不允许**
 *
 * 用法：
 *   node scripts/check-workflow.mjs [文件...]        # 不传参则检查 .github/workflows/*.yml
 *   （lint-staged 会把暂存的文件路径作为参数传进来，支持多个文件）
 *
 * 退出码：发现问题 → 1（这是确定性检查，可以阻断提交）
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * `yaml` 目前是 **vite 的 optional peerDependency**，不在本仓库的 devDependencies 里。
 * 普通 `npm ci` 会装上它，但 `npm ci --omit=optional` 或 vite 侧 peer 变更会让本脚本
 * 连模块都加载不到（评审 MINOR-1）。这里做成显式失败 + 可操作提示，
 * **绝不静默跳过检查**（静默跳过等于把门禁关掉）。
 * 彻底解法是把它登记为显式 devDependency，属需用户确认的依赖变更（见 HANDOVER §13 B-30）。
 */
let parse
try {
  ;({ parse } = await import('yaml'))
} catch {
  console.error(
    '❌ check-workflow 无法加载 `yaml`（当前它是 vite 的 optional peerDependency）。\n' +
      '   修复：npm i -D yaml，或在 HANDOVER §13 B-30 登记后由维护者显式声明该依赖。\n' +
      '   注意：本检查**不会静默跳过** —— 加载失败即视为检查失败。',
  )
  process.exit(1)
}

const JOB_IF_ALLOWED = ['github', 'needs', 'vars', 'inputs', 'always', 'cancelled', 'success', 'failure']
const STEP_IF_ALLOWED = [...JOB_IF_ALLOWED, 'strategy', 'matrix', 'job', 'runner', 'env', 'steps']

/** 提取表达式里用到的上下文名（去掉字符串字面量；宁可误报也不漏报） */
function contextNames(expr) {
  const cleaned = expr.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
  const out = new Set()
  for (const m of cleaned.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\./g)) out.add(m[1])
  return [...out]
}

function checkFile(file) {
  const problems = []
  const doc = parse(readFileSync(file, 'utf8'))
  const jobs = doc?.jobs ?? {}
  if (Object.keys(jobs).length === 0) {
    problems.push('未解析到任何 job（顶层缺少 jobs，或 YAML 结构不对）')
    return problems
  }

  for (const [id, job] of Object.entries(jobs)) {
    if (job?.if) {
      const expr = String(job.if)
      if (expr.includes('secrets')) {
        problems.push(`jobs.${id}.if: 含 secrets —— GitHub 解析期会拒绝整份工作流（修法见 HANDOVER §10.4）`)
      }
      for (const ctx of contextNames(expr)) {
        if (!JOB_IF_ALLOWED.includes(ctx)) {
          problems.push(
            `jobs.${id}.if: 使用了 job 级 if 不可用的上下文 "${ctx}"（允许：${JOB_IF_ALLOWED.join(' / ')}）\n      if: ${expr}`,
          )
        }
      }
    }
    if (!job?.['runs-on'] && !job?.uses) problems.push(`jobs.${id}: 缺少 runs-on`)
    for (const need of job?.needs ?? []) {
      if (!(need in jobs)) problems.push(`jobs.${id}.needs: 引用了不存在的 job "${need}"`)
    }
    for (const [i, step] of (job?.steps ?? []).entries()) {
      const where = `jobs.${id}.steps[${i}]${step?.name ? ` (${step.name})` : ''}`
      if (!step?.uses && !step?.run) problems.push(`${where}: 既没有 uses 也没有 run`)
      if (step?.if) {
        const expr = String(step.if)
        if (expr.includes('secrets')) {
          problems.push(`${where}.if: 含 secrets —— step 级 if 也不允许（改用 job 级 env，见 HANDOVER §10.4）`)
        }
        for (const ctx of contextNames(expr)) {
          if (!STEP_IF_ALLOWED.includes(ctx)) {
            problems.push(`${where}.if: 使用了不可用上下文 "${ctx}"（允许：${STEP_IF_ALLOWED.join(' / ')}）`)
          }
        }
      }
    }
  }
  return problems
}

function resolveTargets(argv) {
  const args = argv.slice(2).filter(a => !a.startsWith('-'))
  if (args.length > 0) return args.filter(f => existsSync(f))
  const dir = path.resolve('.github/workflows')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join('.github', 'workflows', f))
}

const targets = resolveTargets(process.argv)
if (targets.length === 0) {
  console.log('check-workflow：没有找到要检查的工作流文件（.github/workflows/*.yml）')
  process.exit(0)
}

let failed = 0
for (const file of targets) {
  const problems = checkFile(file)
  const jobs = Object.keys(parse(readFileSync(file, 'utf8'))?.jobs ?? {})
  if (problems.length === 0) {
    console.log(`✅ ${file}：${jobs.length} 个 job（${jobs.join(', ')}），未发现上下文/结构问题`)
  } else {
    failed += 1
    console.log(`❌ ${file}：发现 ${problems.length} 处问题`)
    for (const p of problems) console.log(`   - ${p}`)
  }
}
if (failed > 0) process.exitCode = 1
