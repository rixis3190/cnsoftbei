/**
 * build-vectors — 构建期生成 RAG 语料与向量产物（零网络）
 *
 * 用法：
 *   npm run vectors:build                 # 生成 src/data/ragChunks.json + ragVectors.json
 *   npm run vectors:build -- --out-dir=X  # 输出到别处（对比体积用）
 *   npm run vectors:build -- --check      # 只校验：产物哈希与重新生成的不一致则退出码 1
 *
 * 为什么必须构建期产出（铁律 1）：
 * IDF 依赖语料统计，运行期重算会与构建期不一致 → 阈值口径失真且不可复现。
 * 因此 idf 与量化向量一并落盘，运行时只消费不计算。
 *
 * 退出码：0 成功；1 --check 发现漂移或语料异常（跳过率 > 5%）。
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { questions as pythonQuestions } from '../src/data/pythonQuestionBank'
import { questions as javaQuestions } from '../src/data/javaQuestionBank'
import { questions as databaseQuestions } from '../src/data/databaseQuestionBank'
import { buildCorpus, MAX_CHUNK_CHARS, type RagChunk } from '../src/rag/corpusBuilder'
import { createEmbeddingProvider, extractFeatures, fnv1a } from '../src/embedding/embeddingProvider'
import { bytesToBase64, encodeVectors, QUANT_SCALE } from '../src/embedding/vectorStore'
import type { QuestionBank } from '../src/data/tagMap'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'src', 'data')

/** 向量维度：受首屏体积约束取 256（产物 ≈ 块数 × 256 字节，base64 后 ×4/3） */
const DIM = 256
/** 跳过率上限：超过则构建失败（S2-R5：不允许静默丢数据） */
const MAX_SKIP_RATIO = 0.05
/** 块数合理区间（超出说明口径出错，S2-R6） */
const CHUNK_RANGE = [350, 700]

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find(a => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

/** 32 位 FNV-1a 十六进制哈希（与运行时 embedding 使用同一实现） */
function hashText(text: string): string {
  return fnv1a(text).toString(16).padStart(8, '0')
}

const BANKS: { bank: QuestionBank; questions: typeof pythonQuestions }[] = [
  { bank: 'python', questions: pythonQuestions },
  { bank: 'java', questions: javaQuestions },
  { bank: 'database', questions: databaseQuestions },
]

/**
 * 桶级 IDF：df[b] = 至少命中一次该桶的文档数。
 * 已知局限：特征哈希会把不同词折叠到同一桶，dim=256 时 df[b] 几乎等于文档总数，
 * 因此 idf 普遍接近 1.0、区分度很弱。构建摘要会打印 idf 分布把这一点暴露出来，
 * 而不是假装 IDF 很有效。检索区分度主要来自中文 1/2/3-gram 与余弦本身。
 */
function computeIdf(chunks: readonly RagChunk[], dim: number): number[] {
  const df = new Array<number>(dim).fill(0)
  for (const chunk of chunks) {
    const buckets = new Set<number>()
    for (const feature of extractFeatures(chunk.text)) buckets.add(fnv1a(feature) % dim)
    for (const bucket of buckets) df[bucket] += 1
  }
  const n = chunks.length
  return df.map(count => Math.log((n + 1) / (count + 1)) + 1)
}

interface BuildResult {
  chunks: RagChunk[]
  chunksJson: string
  vectorsJson: string
  report: Record<string, unknown>
}

function build(): BuildResult {
  const { chunks, skipped } = buildCorpus(BANKS)
  const skipRatio = chunks.length === 0 ? 1 : skipped.length / (chunks.length + skipped.length)
  if (skipRatio > MAX_SKIP_RATIO) {
    throw new Error(`跳过率 ${(skipRatio * 100).toFixed(1)}% 超过上限 ${MAX_SKIP_RATIO * 100}%，构建中止`)
  }
  if (chunks.length < CHUNK_RANGE[0] || chunks.length > CHUNK_RANGE[1]) {
    console.warn(`[vectors:build] 警告：块数 ${chunks.length} 不在预期区间 ${CHUNK_RANGE}，请确认分块口径未变`)
  }

  const idf = computeIdf(chunks, DIM)
  const provider = createEmbeddingProvider({ dim: DIM, idf })
  const vectors = provider.embedBatch(chunks.map(c => c.text))
  const quantized = encodeVectors(vectors)
  const vectorsBase64 = bytesToBase64(new Uint8Array(quantized.buffer, quantized.byteOffset, quantized.length))

  const chunksJson = `${JSON.stringify(chunks, null, 1)}\n`
  const manifest = {
    dim: DIM,
    model: 'int8-global-scale',
    scale: QUANT_SCALE,
    idf,
    ids: chunks.map(c => c.id),
    vectors: vectorsBase64,
    hash: hashText(chunksJson + vectorsBase64),
  }
  const vectorsJson = `${JSON.stringify(manifest, null, 1)}\n`

  const idfSorted = [...idf].sort((a, b) => a - b)
  const tagCount = new Map<string, number>()
  for (const chunk of chunks) {
    for (const tag of chunk.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1)
  }

  const report = {
    chunkCount: chunks.length,
    questionChunks: chunks.filter(c => c.kind === 'question').length,
    overviewChunks: chunks.filter(c => c.kind === 'tag-overview').length,
    splitChunks: chunks.filter(c => c.partIndex > 0).length,
    maxChunkChars: Math.max(...chunks.map(c => c.text.length)),
    chunkCharsLimit: MAX_CHUNK_CHARS,
    dim: DIM,
    tagCount: Object.fromEntries([...tagCount.entries()].sort((a, b) => b[1] - a[1])),
    skipped,
    skipRatio: Number(skipRatio.toFixed(4)),
    sizeBytes: {
      chunks: Buffer.byteLength(chunksJson, 'utf8'),
      vectors: Buffer.byteLength(vectorsJson, 'utf8'),
    },
    idf: {
      min: Number(idfSorted[0].toFixed(4)),
      median: Number(idfSorted[Math.floor(idfSorted.length / 2)].toFixed(4)),
      max: Number(idfSorted[idfSorted.length - 1].toFixed(4)),
      /** 区分度 = max/min，接近 1 说明 IDF 在当前 dim 下几乎无区分度（已知局限） */
      discrimination: Number((idfSorted[idfSorted.length - 1] / idfSorted[0]).toFixed(4)),
    },
    hash: manifest.hash,
  }

  return { chunks, chunksJson, vectorsJson, report }
}

function main(): void {
  const check = process.argv.includes('--check')
  const outDir = argValue('out-dir') ?? DEFAULT_OUT_DIR
  const { chunksJson, vectorsJson, report } = build()

  const chunksPath = path.join(outDir, 'ragChunks.json')
  const vectorsPath = path.join(outDir, 'ragVectors.json')
  const reportPath = path.join(outDir, 'ragBuildReport.json')

  if (check) {
    const problems: string[] = []
    for (const [file, expected] of [
      [chunksPath, chunksJson],
      [vectorsPath, vectorsJson],
    ] as const) {
      if (!existsSync(file)) {
        problems.push(`缺少产物 ${path.relative(REPO_ROOT, file)}`)
        continue
      }
      if (readFileSync(file, 'utf8') !== expected) {
        problems.push(`产物与重新生成的结果不一致（题库已变动？）：${path.relative(REPO_ROOT, file)}`)
      }
    }
    if (problems.length > 0) {
      console.error('[vectors:check] 失败：')
      for (const p of problems) console.error(`  - ${p}`)
      console.error('  处理方式：运行 npm run vectors:build 后重新提交产物')
      process.exit(1)
    }
    console.log(`[vectors:check] 通过：${report.chunkCount} 块，hash=${report.hash}`)
    return
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(chunksPath, chunksJson, 'utf8')
  writeFileSync(vectorsPath, vectorsJson, 'utf8')
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`
  console.log(
    [
      `[vectors:build] 块数 ${report.chunkCount}` +
        `（题目块 ${report.questionChunks} / 概览块 ${report.overviewChunks} / 长文子块 ${report.splitChunks}）`,
      `[vectors:build] dim=${report.dim} 产物：chunks ${kb(report.sizeBytes.chunks as number)}，vectors ${kb(report.sizeBytes.vectors as number)}`,
      `[vectors:build] idf min/median/max = ${(report.idf as Record<string, number>).min}/${(report.idf as Record<string, number>).median}/${(report.idf as Record<string, number>).max}` +
        `（区分度 ${(report.idf as Record<string, number>).discrimination}，接近 1 即代表 IDF 几乎无区分度）`,
      `[vectors:build] 跳过 ${(report.skipped as unknown[]).length} 条（${(report.skipRatio as number) * 100}%）`,
      `[vectors:build] hash=${report.hash}`,
    ].join('\n'),
  )
  if ((report.skipped as unknown[]).length > 0) {
    console.log(`[vectors:build] 跳过清单见 ${path.relative(REPO_ROOT, reportPath)} 的 skipped[]`)
  }
}

main()
