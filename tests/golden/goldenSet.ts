/**
 * goldenSet — 评测基准集的加载、校验与取样
 *
 * 数据集分两层（见 scripts/gen-golden-dataset.ts 与 实施计划 T-1）：
 * - 金标层 referenceSource='sampleAnswer'：题库真实参考答案，阈值拟合只用这一层；
 * - 合成层 referenceSource='synthesized'：客观题合成参考答案，只进 smoke 集。
 *
 * 校验强度按 reviewed 分流：
 * - reviewed=true  → 全量强校验，任何不合规直接抛错（CI 门禁口径）；
 * - reviewed=false → 结构性错误（id 重复/字段缺失/题库定位失败）抛错，
 *   标注质量问题（要点数、锚点单调性等）只收集为 warning，
 *   避免「人工审校没做完就把门禁弄红」（计划 S1-R1 的兜底口径）。
 */

import rawDataset from './goldenSet.json'
import { questions as pythonQuestions } from '../../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../../src/data/databaseQuestionBank'
import { normalizeTag, type QuestionBank } from '../../src/data/tagMap'
import { coverageRatio, hitsMustExclude } from '../../src/services/textMatch'
import type { Difficulty, QuestionType } from '../../src/types'

export type ReferenceSource = 'sampleAnswer' | 'synthesized'

export interface GoldenAnchors {
  /** 高质量回答锚点（阈值拟合的正样本） */
  excellent: string
  /** 中等质量回答锚点（只用于展示与人工校准，不参与拟合） */
  fair: string
  /** 低质量回答锚点（阈值拟合的负样本） */
  poor: string
}

export interface GoldenItem {
  id: string
  question: string
  referenceAnswer: string
  referenceSource: ReferenceSource
  /** 预期要点：3~5 条，每条 ≤20 字 */
  expectedPoints: string[]
  /** 禁止项（错误说法）：2~3 条 */
  mustExclude: string[]
  anchors: GoldenAnchors
  /** 归一化标签，形如 python-syntax */
  tags: string[]
  moduleId: string
  sourceQuestionId: string
  bank: QuestionBank
  type: QuestionType
  difficulty: Difficulty
  /** 是否已人工审校；false 时只做弱校验 */
  reviewed: boolean
}

export interface GoldenMeta {
  version: number
  generatedBy: string
  /** template=脚本派生初稿；human=全部人工审校 */
  anchorSource: 'template' | 'human'
  reviewedCount: number
  goldCount: number
  smokeCount: number
  note: string
}

export interface GoldenDataset {
  meta: GoldenMeta
  items: GoldenItem[]
}

export interface GoldenPair {
  itemId: string
  /** 正样本文本 = excellent 锚点 */
  positive: string
  /** 负样本文本 = poor 锚点 */
  negative: string
  /** 参考答案文本 */
  reference: string
  /** 该条所属标签，便于按知识点统计区分度 */
  tags: string[]
}

interface SourceQuestion {
  question: string
  sampleAnswer?: string
  type: QuestionType
  tags: string[]
  moduleId: string
  difficulty: Difficulty
}

/** 题库索引：bank + 题号 → 原题，供校验器定位 sourceQuestionId */
const QUESTION_INDEX: Record<QuestionBank, Map<string, SourceQuestion>> = {
  python: new Map(pythonQuestions.map(q => [q.id, q])),
  java: new Map(javaQuestions.map(q => [q.id, q])),
  database: new Map(databaseQuestions.map(q => [q.id, q])),
}

const VALID_TYPES: QuestionType[] = ['choice', 'truefalse', 'short', 'fill']
const VALID_DIFFICULTY: Difficulty[] = ['easy', 'medium', 'hard']
/** 要点最大字数（计划 S1-R5：过长会让要点覆盖率形同虚设） */
export const MAX_POINT_LENGTH = 20
/** 单条要点被 excellent 锚点覆盖的最低比例，低于此值视为标注腐烂 */
const MIN_SELF_COVERAGE = 0.6

/**
 * 加载基准集（返回深拷贝，防止测试相互污染）。
 * JSON 产物本身只读，但调用方直接改对象会污染后续用例。
 */
export function loadGoldenSet(): GoldenDataset {
  return structuredClone(rawDataset) as GoldenDataset
}

export interface GoldenValidationResult {
  errors: string[]
  warnings: string[]
}

/**
 * 校验数据集。
 * @param strict true 时把 warning 也视为错误（用于负向验证与门禁演示）
 */
export function validateGoldenSet(
  dataset: GoldenDataset,
  options: { strict?: boolean } = {},
): GoldenValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { items } = dataset

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('数据集为空')
    return { errors, warnings }
  }

  // 1) id 唯一
  const idSet = new Set<string>()
  for (const item of items) {
    if (idSet.has(item.id)) errors.push(`id 重复：${item.id}`)
    idSet.add(item.id)
  }

  for (const item of items) {
    const at = `[${item.id}]`
    // 结构性错误一律抛错；标注质量问题在未审校时只警告（见文件头说明）
    const structural = (msg: string) => void errors.push(msg)
    const problem = (msg: string) => void (item.reviewed ? errors : warnings).push(msg)

    // 2) 必填字段与枚举
    if (!item.question?.trim()) structural(`${at} question 为空`)
    if (!item.referenceAnswer?.trim()) structural(`${at} referenceAnswer 为空`)
    if (item.referenceSource !== 'sampleAnswer' && item.referenceSource !== 'synthesized') {
      structural(`${at} referenceSource 非法：${String(item.referenceSource)}`)
    }
    if (!VALID_TYPES.includes(item.type)) structural(`${at} type 非法：${String(item.type)}`)
    if (!VALID_DIFFICULTY.includes(item.difficulty)) {
      structural(`${at} difficulty 非法：${String(item.difficulty)}`)
    }

    // 3) 要点：数量、长度、去重
    const points = item.expectedPoints ?? []
    if (points.length < 3 || points.length > 5) {
      problem(`${at} expectedPoints 数量应为 3~5，实际 ${points.length}`)
    }
    for (const point of points) {
      if (!point.trim()) problem(`${at} 存在空要点`)
      else if (point.length > MAX_POINT_LENGTH) {
        problem(`${at} 要点超过 ${MAX_POINT_LENGTH} 字：${point}`)
      }
    }
    if (new Set(points).size !== points.length) problem(`${at} expectedPoints 存在重复`)

    // 4) 禁止项数量
    const excludes = item.mustExclude ?? []
    if (excludes.length < 2) problem(`${at} mustExclude 至少 2 条，实际 ${excludes.length}`)

    // 5) 锚点非空 + 长度单调 poor < fair < excellent
    const { excellent, fair, poor } = item.anchors ?? ({} as GoldenAnchors)
    if (!excellent?.trim() || !fair?.trim() || !poor?.trim()) {
      structural(`${at} 锚点存在空值`)
    } else if (!(poor.length < fair.length && fair.length < excellent.length)) {
      problem(
        `${at} 锚点长度不单调：poor=${poor.length} fair=${fair.length} excellent=${excellent.length}`,
      )
    }

    // 6) 标签必须已归一化（形如 python-syntax，且等于归一化函数的结果）
    for (const tag of item.tags ?? []) {
      if (!tag.startsWith(`${item.bank}-`)) {
        structural(`${at} 标签未归一化（应形如 ${item.bank}-xxx）：${tag}`)
      } else if (tag !== normalizeTag(item.bank, tag.slice(item.bank.length + 1))) {
        structural(`${at} 标签不是归一化结果：${tag}`)
      }
    }

    // 7) sourceQuestionId 必须能在题库定位到，且题干/模块/难度未漂移
    const source = QUESTION_INDEX[item.bank]?.get(item.sourceQuestionId)
    if (!source) {
      structural(`${at} sourceQuestionId 在 ${item.bank} 题库中不存在：${item.sourceQuestionId}`)
    } else {
      if (source.question !== item.question) {
        structural(`${at} 题干与题库不一致（题库已漂移，请运行 npm run golden:build）`)
      }
      if (source.moduleId !== item.moduleId) structural(`${at} moduleId 与题库不一致`)
      if (source.difficulty !== item.difficulty) structural(`${at} difficulty 与题库不一致`)

      // 8) referenceSource 必须与题库实际字段一致
      if (item.referenceSource === 'sampleAnswer') {
        if (!source.sampleAnswer) {
          structural(`${at} 标注为 sampleAnswer，但题库该题没有 sampleAnswer`)
        } else if (source.sampleAnswer.trim() !== item.referenceAnswer.trim()) {
          structural(`${at} referenceAnswer 与题库 sampleAnswer 不一致`)
        }
      } else if (source.sampleAnswer) {
        structural(`${at} 标注为 synthesized，但题库该题已有 sampleAnswer（应归金标层）`)
      }
    }

    // 9) 防标注腐烂：excellent 锚点必须覆盖大部分要点
    const selfCoverage = coverageRatio(points, excellent)
    if (selfCoverage < MIN_SELF_COVERAGE) {
      problem(
        `${at} excellent 锚点只覆盖 ${(selfCoverage * 100).toFixed(0)}% 要点（<${MIN_SELF_COVERAGE * 100}%），标注可能已腐烂`,
      )
    }

    // 10) 禁止项不能与参考答案/优秀锚点自相矛盾
    const contradicted = hitsMustExclude(`${item.referenceAnswer} ${excellent}`, excludes)
    if (contradicted.length > 0) {
      problem(`${at} 禁止项与参考答案自相矛盾：${contradicted.join(' / ')}`)
    }
  }

  return options.strict ? { errors: [...errors, ...warnings], warnings } : { errors, warnings }
}

/** 校验失败直接抛错，带完整问题清单 */
export function assertGoldenSet(dataset: GoldenDataset, options: { strict?: boolean } = {}): void {
  const { errors } = validateGoldenSet(dataset, options)
  if (errors.length > 0) {
    throw new Error(`基准集校验失败（${errors.length} 项）：\n - ${errors.join('\n - ')}`)
  }
}

/** 金标层：题库真实参考答案，阈值拟合与主要评测只用这一层 */
export function getGoldSet(items: readonly GoldenItem[]): GoldenItem[] {
  return items.filter(item => item.referenceSource === 'sampleAnswer')
}

/** 合成层：客观题合成参考答案，只进 smoke 集 */
export function getSmokeSet(items: readonly GoldenItem[]): GoldenItem[] {
  return items.filter(item => item.referenceSource === 'synthesized')
}

/**
 * 正负样本对：只取 excellent / poor，fair 永不参与阈值拟合（计划 S1-5）。
 * 合成层不参与拟合（计划 T-1：用合成答案拟合阈值会得到假结论）。
 */
export function getPositiveNegativePairs(items: readonly GoldenItem[]): GoldenPair[] {
  return getGoldSet(items).map(item => ({
    itemId: item.id,
    positive: item.anchors.excellent,
    negative: item.anchors.poor,
    reference: item.referenceAnswer,
    tags: item.tags,
  }))
}
