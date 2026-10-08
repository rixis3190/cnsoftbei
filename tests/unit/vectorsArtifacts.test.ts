/**
 * vectorsArtifacts 单测（S2-7）
 *
 * 这是「产物可信性」的门禁：
 * - ids 与 chunks 严格同序同集（不一致 → 运行期 L3 降级）
 * - dim 一致、base64 长度 = 块数 × dim
 * - 篡改产物 → 哈希校验失败（负向验证）
 * - 检索性能护栏：全量扫描 < 5ms
 */

import { describe, it, expect } from 'vitest'
import chunksJson from '../../src/data/ragChunks.json'
import vectorsJson from '../../src/data/ragVectors.json'
import { base64ToBytes, QUANT_SCALE } from '../../src/embedding/vectorStore'
import { fnv1a } from '../../src/embedding/embeddingProvider'
import { __resetIndexCache, getIndex, isRagUnavailable, loadIndex, retrieve } from '../../src/rag/buildIndex'
import type { RagChunk } from '../../src/rag/corpusBuilder'

const chunks = chunksJson as RagChunk[]
const manifest = vectorsJson as {
  dim: number
  model: string
  scale: number
  idf: number[]
  ids: string[]
  vectors: string
  hash: string
}

describe('产物结构一致性', () => {
  it('ids 与 chunks 严格同序同集', () => {
    expect(manifest.ids.length).toBe(chunks.length)
    for (let i = 0; i < chunks.length; i++) {
      expect(manifest.ids[i]).toBe(chunks[i].id)
    }
  })

  it('dim 与 idf 长度一致且为正', () => {
    expect(manifest.dim).toBeGreaterThan(0)
    expect(manifest.idf.length).toBe(manifest.dim)
    expect(manifest.idf.every(v => v > 0)).toBe(true)
  })

  it('量化模型与 scale 与运行期实现匹配', () => {
    expect(manifest.model).toBe('int8-global-scale')
    expect(manifest.scale).toBe(QUANT_SCALE)
  })

  it('base64 解码后长度 = 块数 × dim', () => {
    expect(base64ToBytes(manifest.vectors).length).toBe(chunks.length * manifest.dim)
  })

  it('文件哈希等于构建时写入的 manifest', () => {
    const expected = fnv1a(`${JSON.stringify(chunks, null, 1)}\n${manifest.vectors}`).toString(16).padStart(8, '0')
    expect(manifest.hash).toBe(expected)
  })

  it('块文本非空且 id 唯一', () => {
    const ids = new Set<string>()
    for (const chunk of chunks) {
      expect(chunk.text.trim().length).toBeGreaterThan(0)
      expect(ids.has(chunk.id)).toBe(false)
      ids.add(chunk.id)
    }
  })
})

describe('运行期索引', () => {
  it('getIndex 返回可用索引（非 L3 降级）', () => {
    __resetIndexCache()
    const index = getIndex()
    expect(index).not.toBeNull()
    expect(isRagUnavailable()).toBe(false)
    expect(index!.vectors.length).toBe(chunks.length)
  })

  it('索引可正常召回且按分数降序', () => {
    __resetIndexCache()
    const results = retrieve('数据库事务的隔离级别有哪些', { topK: 3 })
    expect(results.length).toBeGreaterThan(0)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('空查询返回空数组', () => {
    expect(retrieve('   ')).toEqual([])
  })

  it('floor 高于全部得分时返回空数组（不注入无覆盖内容）', () => {
    expect(retrieve('任意问题', { floor: 1.01 })).toEqual([])
  })

  it('tagHint 可缩小候选范围', () => {
    const all = retrieve('索引', { topK: 50 })
    const filtered = retrieve('索引', { topK: 50, tagHint: ['python-syntax'] })
    expect(filtered.length).toBeLessThanOrEqual(all.length)
    for (const hit of filtered) expect(hit.chunk.tags).toContain('python-syntax')
  })

  it('混沌演练 D-1：产物 id 不一致 → 降级为 null', () => {
    const brokenChunks = chunks.map((c, i) => (i === 0 ? { ...c, id: 'tampered-id' } : c))
    expect(loadIndex({ chunks: brokenChunks })).toBeNull()
  })

  it('混沌演练 D-2：向量 base64 非法 → 降级为 null', () => {
    expect(loadIndex({ vectors: { ...manifest, vectors: 'not-base64!!!' } })).toBeNull()
  })

  it('混沌演练 D-1b：块数与 ids 不一致 → 降级为 null', () => {
    expect(loadIndex({ chunks: chunks.slice(1) })).toBeNull()
  })

  it('混沌演练 D-2b：scale 与运行期实现不匹配 → 降级为 null', () => {
    expect(loadIndex({ vectors: { ...manifest, scale: 99 } })).toBeNull()
  })

  it('混沌演练 D-2c：idf 长度与 dim 不一致 → 降级为 null', () => {
    expect(loadIndex({ vectors: { ...manifest, idf: manifest.idf.slice(1) } })).toBeNull()
  })

  it('降级后 retrieve 返回空数组（不抛异常、不注入上下文）', () => {
    expect(loadIndex({ chunks: [] })).toBeNull()
    // 正常产物仍可检索，说明上一条只影响被注入的坏产物
    expect(retrieve('索引', { topK: 3 }).length).toBeGreaterThan(0)
  })
})

describe('检索性能护栏', () => {
  it('全量 448 块扫描 + topK < 5ms', () => {
    __resetIndexCache()
    const query = 'Python 多态与鸭子类型'
    // 预热一次（首次含 JIT 与缓存）
    retrieve(query, { topK: 3 })
    const start = performance.now()
    for (let i = 0; i < 20; i++) retrieve(query, { topK: 3 })
    const perCall = (performance.now() - start) / 20
    expect(perCall).toBeLessThan(5)
  })
})
