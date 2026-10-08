/**
 * evalConfig — 特性开关矩阵（容错骨架，计划 §1.2）
 *
 * 所有开关集中在这里，**禁止散落在业务代码里**：回滚手段的第一优先级就是
 * 「改 1 行配置，不动逻辑」（计划 §1.5）。
 *
 * 降级链（计划 §1.3）：
 *   L0 正常 → L1 语义降级（影子模式）→ L2 模型降级 → L3 RAG 降级 → L4 纯规则
 * 每一级都由本文件的开关或 qualityFunnel 内部的 try/catch 保证。
 */

export type EvalMode = 'offline' | 'live'

export interface EvalSwitches {
  /** RAG 检索 + 上下文注入；关闭时 retrieveForQuestion 直接返回 [] */
  RAG_ENABLED: boolean
  /** 语义层（余弦 + 要点 + 禁止项） */
  SEMANTIC_LAYER_ENABLED: boolean
  /** 模型层 LLM 评审 */
  MODEL_LAYER_ENABLED: boolean
  /** 语义层只观测不拦截（阈值区分度不足时用，计划 T3-1） */
  SEMANTIC_SHADOW_MODE: boolean
  /** offline = 任何代码路径触发网络都视为 bug；live 才允许真实 LLM 调用 */
  EVAL_MODE: EvalMode
  /** 模型层降级是否阻塞用户体验 */
  MODEL_DEGRADE_IS_BLOCKING: boolean
}

const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<
  string,
  string | undefined
>

function envFlag(name: string, fallback: boolean): boolean {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  return raw === 'true' || raw === '1'
}

/**
 * 默认值刻意保守（计划 §1.2 + T3-1 兜底）：
 * - RAG 关：计划 S4-R1 判定「RAG 反而让回答变差」是最高概率风险，必须 A/B 对照后再开；
 * - **语义层默认关闭**：阈值来自脚本派生的模板锚点（reviewed=false），区分度未经人工审校。
 *   另外要注意：Tutor 的生产链路不注入 reference/scorer（自由提问没有标准答案），
 *   因此即使把本开关打开，语义层在生产里也不会执行 —— 它只在评测链路中被使用。
 *   这条事实同时写在 docs/eval-methodology.md，两处必须一致。
 * - 影子模式默认开：语义层一旦被启用（评测链路/未来接入题库题），仍然只记录不拦截；
 * - 模型层开：改造前 Tutor 就有 AI 评审，关掉等于功能回退；
 * - EVAL_MODE=offline：offline 下不期望真实 LLM 调用。
 *
 * 环境变量名前缀说明：走 Vite 的 `import.meta.env`，因此**必须带 `VITE_` 前缀**
 * （计划文档里写的 `EVAL_MODE` 是简写，实际读的是 `VITE_EVAL_MODE`）。
 */
export const EVAL_SWITCHES: EvalSwitches = {
  RAG_ENABLED: envFlag('VITE_RAG_ENABLED', false),
  SEMANTIC_LAYER_ENABLED: envFlag('VITE_SEMANTIC_LAYER_ENABLED', false),
  MODEL_LAYER_ENABLED: envFlag('VITE_MODEL_LAYER_ENABLED', true),
  SEMANTIC_SHADOW_MODE: envFlag('VITE_SEMANTIC_SHADOW_MODE', true),
  EVAL_MODE: (env['VITE_EVAL_MODE'] as EvalMode) || 'offline',
  MODEL_DEGRADE_IS_BLOCKING: envFlag('VITE_MODEL_DEGRADE_IS_BLOCKING', false),
}

/**
 * 是否允许真实 LLM 调用（双重 gate：开关 + 模式）。
 *
 * **已知现状（不要误以为它已经生效）**：目前 `api.ts` 还没有接入这个 gate，
 * 真实调用的隔离实际由「测试侧」保证 —— `vitest.config.ts` 排除了 `tests/integration/**`，
 * 真实接口用例必须显式 `npm run test:api` 才会跑（见 T-8）。
 * 保留本函数是给后续「运行期出网守卫」留的入口，接线前不要在文档里声称它已生效。
 */
export function liveEvalAllowed(): boolean {
  return EVAL_SWITCHES.EVAL_MODE === 'live'
}
