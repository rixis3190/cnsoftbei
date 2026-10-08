/**
 * tutorQuality.ts
 *
 * Tutor 回答质量验证工具函数
 * - 规则校验（零成本）
 * - 关键词匹配（追问上下文粗筛）
 */

import type { QAItem } from '../types';

// ==================== 规则校验 ====================

export interface ValidationResult {
  pass: boolean;
  reason?: string;
}

/**
 * 零成本规则校验：检查回答基本质量
 */
export function validateAnswerRules(answer: string, questionText: string): ValidationResult {
  // 回答过短
  if (answer.trim().length < 50) {
    return { pass: false, reason: `回答仅 ${answer.trim().length} 字，过短` };
  }

  // 拒绝性语句
  const rejectPatterns = [
    '我无法回答', '我不能回答', '抱歉，我无法', '抱歉，我不能',
    '这个问题我无法', '我没有能力', 'I cannot', 'I\'m unable',
  ];
  if (rejectPatterns.some(p => answer.includes(p))) {
    return { pass: false, reason: '回答包含拒绝性语句' };
  }

  // 关键词重叠检查（粗略，用 2-gram 匹配）
  const qTokens = extractTokens(questionText);
  const aTokens = extractTokens(answer);
  let overlap = 0;
  for (const t of qTokens) {
    if (aTokens.has(t)) overlap++;
  }
  if (qTokens.size > 5 && overlap === 0) {
    return { pass: false, reason: '回答与问题无关键词重叠' };
  }

  return { pass: true };
}

// ==================== 关键词匹配 ====================

/** 中文停用词 */
/**
 * 停用词表（导出供向量检索与关键词通道复用）。
 * 导出属零行为变更的重构：内部仍在同一处过滤，findBestMatchByKeywords 行为不变。
 */
export const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '那', '什么', '怎么', '如何', '为什么',
  '请', '能', '可以', '吗', '呢', '吧', '啊',
]);

/**
 * 从文本中提取中文词和英文词
 * 中文按 2-gram 切分（连续字符两两组合），英文按完整词提取（3+ 字符）
 */
export function extractTokens(text: string): Set<string> {
  const result = new Set<string>();
  // 提取英文词（3+ 字符）
  const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];
  englishWords.forEach(w => result.add(w.toLowerCase()));
  // 提取中文 2-gram（相邻两字组合）
  const chineseChars = text.match(/[一-鿿]/g) || [];
  for (let i = 0; i < chineseChars.length - 1; i++) {
    result.add(chineseChars[i] + chineseChars[i + 1]);
  }
  return result;
}

/**
 * 计算两个 token 集合的 Jaccard 相似度
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/**
 * 关键词粗筛：从用户输入提取关键词，与历史 QA 做 Jaccard 相似度匹配
 * 纯本地操作，不调 API
 */
export function findBestMatchByKeywords(
  input: string,
  qaHistory: QAItem[],
  threshold = 0.1,
): QAItem | null {
  const inputTokens = extractTokens(input);
  const filteredInput = new Set([...inputTokens].filter(t => !STOP_WORDS.has(t)));
  if (filteredInput.size === 0) return null;

  // 计算每个历史 QA 的 Jaccard 相似度
  const scored = qaHistory
    .filter(qa => qa.answer && qa.answer.length > 0)
    .map(qa => {
      const qaTokens = extractTokens(qa.question);
      const similarity = jaccardSimilarity(filteredInput, qaTokens);
      return { qa, similarity };
    })
    .filter(s => s.similarity > threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  return scored.length > 0 ? scored[0].qa : null;
}
