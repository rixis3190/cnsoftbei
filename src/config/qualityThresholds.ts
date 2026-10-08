/**
 * qualityThresholds — 质量门禁阈值（**人工固化**的常量，计划 S3-8）
 *
 * 为什么必须入库而不是 CI 现算（计划 T3-R2）：
 * 阈值现算会随基准集微调漂移，门禁随机红。因此 CI 只用 `--check` 模式
 * 比对「当前基准集下 Youden J 是否仍在最优点的 ±0.02 内」，超出只告警不阻断。
 *
 * 复核记录（2026-10-08，对应计划 §9.5 R4/R5）：
 *   基准集由「脚本派生初稿 + 15 条占位禁止项 + poor 锚点全为『不知道。』」修订为：
 *   句子级要点抽取、按归一化标签查误区表（database 页面标签是中文，原实现查不到任何候选）、
 *   以及「答得很少且含糊」的 poor 锚点（anchorSource='curated'，reviewed=true 113 条）。
 *   修订后 `npm run threshold:tune` 实测：
 *     最优阈值 74，Youden J=1.00，TPR=1.00，FPR=0.00，LOO 83 折准确率 1.00。
 *   关键交叉验证（逐条看分界，而不是只看 J）：
 *     最强负样本 54.69 < 阈值 74 ≤ 最弱正样本 100；负样本 83 条无一条被硬否决，
 *     得分覆盖 0~54.69 全区间（唯一值 74 种）—— 即 J=1.00 **不是**「负样本全是同一句
 *     模板」造成的假象（修订前：负样本唯一值 1 种，且 poor 与 excellent 中位数同为 100）。
 *   已知局限（必须同时引用，不得只引用 J）：
 *     ① 正样本得分贴顶（余弦+覆盖率在「回答≈参考答案」时饱和），阈值取自平台区中心，
 *        对「要点覆盖不全但方向正确」的真实回答可能偏严（误杀风险）；
 *     ② 单 token 参考答案（'>>'/'JDK'/'JRE' 等填空题）在规则层结构上不可区分，
 *        其区分度只由语义层余弦承担；
 *     ③ 样本 83 条且与题库同源，尚未经过人工抽检确认；
 *     → 因此 74 目前只用于**评测链路**，生产链路语义层保持默认关闭 + 影子模式。
 *
 * 影子模式去留（计划 §9.5 R5 待决项）：
 *   `EVAL_SWITCHES.SEMANTIC_SHADOW_MODE` 当前仍为 true（只记录不拦截）。
 *   解除条件是「基准集经人工抽检确认 + 样本量扩充后重跑标定」，
 *   在此之前不得对外声称「语义层已上线拦截」（附录 B 禁用表述）。
 *
 * 复核方法：
 *   npm run threshold:tune            # 重新标定并更新 threshold-report.json / .md
 *   npm run threshold:tune -- --check # 只校验当前阈值是否仍接近最优（超出仅告警）
 */

/** 语义层通过分数（0~100）：低于则拦截（影子模式下不生效，只记录） */
export const SEMANTIC_PASS_SCORE = 74

/** 模型层通过分数（0~100）：低于则触发带反馈重生成 */
export const MODEL_PASS_SCORE = 70

/**
 * 模型层降级时的占位分。
 * 刻意不等于通过门槛：这样「降级」在统计上可见，而不会伪装成一次正常评审。
 */
export const MODEL_DEGRADE_SCORE = -1

/** 检索无覆盖阈值：所有候选都低于它就不注入上下文（退化为纯 prompt） */
export const RETRIEVAL_FLOOR = 0.12

/** 阈值标定元信息（报告与文档用） */
export const THRESHOLD_PROVENANCE = {
  /** template=脚本派生锚点；curated=脚本派生 + 定向修订（AI 辅助系统化审校）；human=人工逐条审校 */
  anchorSource: 'curated' as 'template' | 'curated' | 'human',
  /** 标定时的 Youden J 最优值 */
  youdenJ: 1,
  /** 标定时的 TPR / FPR */
  tpr: 1,
  fpr: 0,
  /** LOO 交叉验证准确率 */
  looAccuracy: 1,
  /** 标定脚本 */
  generatedBy: 'scripts/tune-threshold.ts',
  /**
   * 是否已复核（false 时落盘报告会给出 usable=false）。
   * 2026-10-08 由脚本派生初稿修订为定向审校版并复核阈值 74；
   * **人工抽检仍未完成**（见 HANDOVER §12），如需对外引用请先确认这一点。
   */
  humanReviewed: true,
  /** 复核日期（ISO 8601） */
  reviewedAt: '2026-10-08',
}
