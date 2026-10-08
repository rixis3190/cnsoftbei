/**
 * qualityThresholds — 质量门禁阈值（**人工固化**的常量，计划 S3-8）
 *
 * 为什么必须入库而不是 CI 现算（计划 T3-R2）：
 * 阈值现算会随基准集微调漂移，门禁随机红。因此 CI 只用 `--check` 模式
 * 比对「当前基准集下 Youden J 是否仍在最优点的 ±0.02 内」，超出只告警不阻断。
 *
 * 复核记录（2026-10-08，对应计划 §9.5 R4/R5）：
 *   基准集由「脚本派生初稿 + 15 条占位禁止项 + poor 锚点全为『不知道。』」修订为：
 *   句子级要点抽取、按归一化标签查误区表（database 题库原始标签是中文，原实现查不到任何候选）、
 *   以及「答得很少且含糊」的 poor 锚点（`anchorSource='curated'`，reviewed=true 113 条）。
 *   `npm run threshold:tune` 实测（同一份数据反复运行结果一致）：
 *     最优阈值 77，Youden J=1.00，TPR=1.00，FPR=0.00，平台区宽度 44；
 *     LOO 83 折准确率 1.00，**稳定折占比 97.6%**（2 折的阈值落在 ±0.02 外，中心位置本身有抖动）。
 *   关键交叉验证（逐条看分界，而不是只看 J）：
 *     最强负样本 60.54 < 阈值 77 ≤ 最弱正样本 100；负样本 83 条无一条被硬否决，
 *     得分唯一值 68 种 —— 即 J=1.00 **不是**「负样本全是同一句模板」造成的假象
 *     （修订前：负样本唯一值 1 种，poor 与 excellent 中位数同为 100）。
 *   已知局限（必须同时引用，不得只引用 J）：
 *     ① 正样本得分贴顶（余弦+覆盖率在「回答≈参考答案」时饱和），阈值取自平台区中心，
 *        对「要点覆盖不全但方向正确」的真实回答可能偏严（误杀风险）；
 *     ② 单 token 参考答案（'>>'/'JDK'/'JRE' 等填空题）的区分度只由语义层余弦承担；
 *     ③ 样本 83 条且与题库同源，**人工抽检未完成**；
 *     → 因此 77 目前只用于**评测链路**，生产链路语义层保持默认关闭 + 影子模式。
 *
 * 复核方法：
 *   npm run threshold:tune            # 重新标定并更新 threshold-report.json / .md
 *   npm run threshold:tune -- --check # 只校验当前阈值是否仍接近最优（超出仅告警）
 */

/** 语义层通过分数（0~100）：低于则拦截（影子模式下不生效，只记录） */
export const SEMANTIC_PASS_SCORE = 77

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
   * 是否已人工复核（false 时落盘报告会给出 usable=false）。
   *
   * **保持 false（评审 MAJOR-1）**：本字段是 `usable` 判定的实质性闸门，
   * 而基准集目前只经过 AI 辅助系统化审校（`meta.reviewedBy='ai-assisted-systematic-review'`），
   * 人工抽检尚未完成（`HANDOVER.md` §13 B-24 为 P0）。
   * 置 true 会让报告显示「人工复核：是」「usable=true」，
   * 与「抽检完成前任何评测数字不得对外引用」的项目红线自相矛盾。
   *
   * 解锁条件：B-24 抽检 ≥20 条通过后，把本字段置 true 并重跑 `npm run threshold:tune`。
   */
  humanReviewed: false,
  /** 已完成的审校方式（与 `humanReviewed` 区分：这是「谁做了审校」，不是「可否对外引用」） */
  structuralReview: 'ai-assisted-systematic-review' as const,
  /** 复核日期（ISO 8601） */
  reviewedAt: '2026-10-08',
}
