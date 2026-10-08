/**
 * qualityThresholds — 质量门禁阈值（**人工固化**的常量，计划 S3-8）
 *
 * 为什么必须入库而不是 CI 现算（计划 T3-R2）：
 * 阈值现算会随基准集微调漂移，门禁随机红。因此 CI 只用 `--check` 模式
 * 比对「当前基准集下 Youden J 是否仍在最优点的 ±0.02 内」，超出只告警不阻断。
 *
 * ⚠️ 当前状态：**机器标定 + 未人工审校**（计划 S3-8 的「人工固化」尚未完成）
 * 下面三个数字由 `npm run threshold:tune` 在**脚本派生锚点**（reviewed=false）上算出：
 *   最优阈值 61（Youden J 平原中心，J=1.00，TPR=1.00，FPR=0.00，LOO 83 折准确率 1.00）
 * 但 J=1.00 本身是可疑信号：负样本锚点只有一句固定模板，区分信息不足，
 * 因此标定脚本判定 usable=false，语义层保持**影子模式**（只记录不拦截，误杀率 0）。
 * 人工审校（计划 S1-4）+ 复核 ROC 表后，才可以把 SEMANTIC_SHADOW_MODE 置 false。
 *
 * 复核方法：
 *   npm run threshold:tune            # 重新标定并更新 threshold-report.json / .md
 *   npm run threshold:tune -- --check # 只校验当前阈值是否仍接近最优（超出仅告警）
 */

/** 语义层通过分数（0~100）：低于则拦截（影子模式下不生效，只记录） */
export const SEMANTIC_PASS_SCORE = 61

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
  /** template=脚本派生锚点，human=人工审校锚点 */
  anchorSource: 'template' as 'template' | 'human',
  /** 标定时的 Youden J 最优值 */
  youdenJ: 1,
  /** 标定时的 TPR / FPR */
  tpr: 1,
  fpr: 0,
  /** LOO 交叉验证准确率 */
  looAccuracy: 1,
  /** 标定脚本 */
  generatedBy: 'scripts/tune-threshold.ts',
  /** 是否已人工复核（false 时语义层必须保持影子模式） */
  humanReviewed: false,
}
