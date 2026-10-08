/**
 * gen-rag-queries — 生成 RAG 评测查询集（计划 S4-5），零网络
 *
 * 两类查询，**必须分开统计**（否则指标会自我美化）：
 * - kind='stem'：直接用题库题干当查询。金标块唯一确定，但查询与块文本高度重合，
 *   召回率天然虚高 —— 它的作用是「管道是否接通」的健康检查，不是检索质量结论；
 * - kind='paraphrase'：手写口语化改写（同一个知识点换个说法问）。
 *   这类才是检索质量的真实样本，量少（十余条）但结论可信。
 *
 * 概览型查询（topic-overview 块）单列 kind='overview'。
 *
 * 用法：npm run rag:queries（生成 tests/golden/rag-queries.json）
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { questions as pythonQuestions } from '../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../src/data/databaseQuestionBank'
import { bankLabel, normalizeTags, tagLabel, type QuestionBank } from '../src/data/tagMap'
import { buildCorpus, MIN_TAG_OVERVIEW_QUESTIONS } from '../src/rag/corpusBuilder'
import type { PracticeQuestion } from '../src/types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const OUT_FILE = path.join(REPO_ROOT, 'tests', 'golden', 'rag-queries.json')

/**
 * 手写口语化查询：覆盖不同知识点，模拟真实用户措辞。
 * goldTag 用**归一化标签**，gold 块在运行时按标签+块类型解析，避免手写块 id 写错。
 */
const PARAPHRASES: { query: string; goldTag: string }[] = [
  { query: 'python 里两个等于号和一个等于号到底差在哪', goldTag: 'python-operators' },
  { query: '为什么 list 传进函数后外面也跟着变了', goldTag: 'python-functions' },
  { query: '装饰器到底是怎么把函数包起来的', goldTag: 'python-decorators' },
  { query: '多继承的时候方法到底按什么顺序找', goldTag: 'python-inheritance' },
  { query: 'try 里面的 finally 会被跳过吗', goldTag: 'python-exceptions' },
  { query: '打开文件忘记 close 会出什么问题', goldTag: 'python-files' },
  { query: '可变对象当默认参数有什么坑', goldTag: 'python-errorprone' },
  { query: '推导式能不能代替普通的 for 循环', goldTag: 'python-comprehensions' },
  { query: 'java 的 hashmap 什么时候会变成红黑树', goldTag: 'java-collections' },
  { query: 'arraylist 和 linkedlist 怎么选', goldTag: 'java-collections' },
  { query: '接口和抽象类到底差在哪', goldTag: 'java-interfaces' },
  { query: '泛型会不会在运行期被擦掉', goldTag: 'java-generics' },
  { query: '线程里 start 和 run 有什么不一样', goldTag: 'java-multithreading' },
  { query: 'volatile 能不能保证 i++ 是原子的', goldTag: 'java-multithreading' },
  { query: 'try catch 后面 finally 一定执行吗', goldTag: 'java-exceptions' },
  { query: 'string 驻留和常量池是什么关系', goldTag: 'java-data-types' },
  { query: '数据库四个隔离级别分别解决什么问题', goldTag: 'database-transaction' },
  { query: '索引为什么有时候反而让写入变慢', goldTag: 'database-index' },
  { query: '外键约束到底有什么代价', goldTag: 'database-constraints' },
  { query: '内连接和左连接的结果差在哪', goldTag: 'database-multi-table-query' },
  { query: '第三范式是不是越符合越好', goldTag: 'database-design' },
  { query: '备份和恢复需要考虑哪些东西', goldTag: 'database-ops' },
]

/** 概览型查询（覆盖题数 ≥3 的标签） */
function buildOverviewQueries(): { id: string; query: string; goldChunkIds: string[]; kind: string; tags: string[] }[] {
  const { chunks } = buildCorpus([
    { bank: 'python', questions: pythonQuestions },
    { bank: 'java', questions: javaQuestions },
    { bank: 'database', questions: databaseQuestions },
  ])
  return chunks
    .filter(c => c.kind === 'tag-overview')
    .map(c => ({
      id: `overview-query-${c.id}`,
      // 用自然语言提问（题库名 + 中文标签），不用 slug —— 用户不会写 "python-syntax"
      query: `${bankLabel(c.bank)} ${tagLabel(c.tags[0])}这个主题整体讲了什么，有哪些常考点？`,
      goldChunkIds: [c.id],
      kind: 'overview',
      tags: c.tags,
    }))
}

function main(): void {
  const banks: { bank: QuestionBank; questions: PracticeQuestion[] }[] = [
    { bank: 'python', questions: pythonQuestions },
    { bank: 'java', questions: javaQuestions },
    { bank: 'database', questions: databaseQuestions },
  ]

  const chunkIds = new Set(
    buildCorpus(banks).chunks.map(c => c.id),
  )

  const stemQueries = banks.flatMap(({ bank, questions }) =>
    questions
      .filter(q => q.sampleAnswer)
      .map(q => ({
        id: `stem-${bank}-${q.id}`,
        query: q.question,
        goldChunkIds: [`${bank}-${q.id}`],
        kind: 'stem',
        tags: normalizeTags(bank, q.tags),
      })),
  )

  const paraphraseQueries = PARAPHRASES.map((p, i) => {
    // 口语化查询没有单一「正确块」：金标取该标签下得分靠前的块
    // 运行时用 tagHint 限定候选集，因此这里只声明标签，具体块由评测脚本解析
    return {
      id: `paraphrase-${i + 1}`,
      query: p.query,
      goldChunkIds: [],
      goldTag: p.goldTag,
      kind: 'paraphrase',
      tags: [p.goldTag],
    }
  })

  const overviewQueries = buildOverviewQueries()

  // 一致性自检：金标块必须真实存在（口语化查询除外，它按标签解析）
  const problems: string[] = []
  for (const q of [...stemQueries, ...overviewQueries]) {
    for (const id of q.goldChunkIds) {
      if (!chunkIds.has(id)) problems.push(`金标块不存在：${id}`)
    }
  }
  if (problems.length > 0) {
    console.error('[rag:queries] 生成失败：')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }

  const dataset = {
    meta: {
      generatedBy: 'scripts/gen-rag-queries.ts',
      reviewed: false,
      counts: {
        stem: stemQueries.length,
        paraphrase: paraphraseQueries.length,
        overview: overviewQueries.length,
        total: stemQueries.length + paraphraseQueries.length + overviewQueries.length,
      },
      note:
        'stem 类查询与块文本高度重合，召回率天然虚高，只用于「管道是否接通」的健康检查；' +
        'paraphrase 类是手写口语化查询，量少但才是检索质量的真实样本；' +
        '报告必须分开统计，不许合并成一个数字。',
      minTagOverviewQuestions: MIN_TAG_OVERVIEW_QUESTIONS,
    },
    queries: [...stemQueries, ...paraphraseQueries, ...overviewQueries],
  }

  mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')
  console.log(
    `[rag:queries] 共 ${dataset.meta.counts.total} 条（stem ${dataset.meta.counts.stem} / paraphrase ${dataset.meta.counts.paraphrase} / overview ${dataset.meta.counts.overview}）→ ${path.relative(REPO_ROOT, OUT_FILE)}`,
  )
}

main()

