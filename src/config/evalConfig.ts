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
 * - 语义层开但**影子模式**：阈值来自脚本派生的模板锚点（reviewed=false），
 *   区分度未经人工审校确认，因此只记录不拦截 —— 误杀率 0（计划 T3-1 的兜底方向）；
 * - 模型层开：改造前 Tutor 就有 AI 评审，关掉等于功能回退；
 * - EVAL_MODE=offline：offline 下任何真实 LLM 调用都视为 bug。
 */
export const EVAL_SWITCHES: EvalSwitches = {
  RAG_ENABLED: envFlag('VITE_RAG_ENABLED', false),
  SEMANTIC_LAYER_ENABLED: envFlag('VITE_SEMANTIC_LAYER_ENABLED', false),
  MODEL_LAYER_ENABLED: envFlag('VITE_MODEL_LAYER_ENABLED', true),
  SEMANTIC_SHADOW_MODE: envFlag('VITE_SEMANTIC_SHADOW_MODE', true),
  EVAL_MODE: (env['VITE_EVAL_MODE'] as EvalMode) || 'offline',
  MODEL_DEGRADE_IS_BLOCKING: envFlag('VITE_MODEL_DEGRADE_IS_BLOCKING', false),
}

/** 是否允许真实 LLM 调用（双重 gate：开关 + 模式） */
export function liveEvalAllowed(): boolean {
  return EVAL_SWITCHES.EVAL_MODE === 'live'
}
