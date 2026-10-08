/**
 * embeddingProvider 单测（S2-7）
 * 核心是「可复现性」：同输入必须位级相同，否则阈值与门禁会随机红（铁律 1）。
 */

import { describe, it, expect } from 'vitest'
import { createEmbeddingProvider, extractFeatures, fnv1a } from '../../src/embedding/embeddingProvider'

const DIM = 256
const idf = new Array(DIM).fill(1)
const provider = createEmbeddingProvider({ dim: DIM, idf })

function l2Norm(v: Float32Array): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  return Math.sqrt(sum)
}

describe('fnv1a', () => {
  it('确定性且非负', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'))
    expect(fnv1a('abc')).toBeGreaterThanOrEqual(0)
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'))
  })

  it('空串也有确定值', () => {
    expect(fnv1a('')).toBe(fnv1a(''))
  })
})

describe('extractFeatures', () => {
  it('中文生成 1/2/3-gram', () => {
    const features = extractFeatures('构造函数')
    expect(features).toContain('构')
    expect(features).toContain('构造')
    expect(features).toContain('构造函')
    // n 最大为 3，因此 4 字词不会整词出现（这是有意的特征数控制）
    expect(features).not.toContain('构造函数')
  })

  it('英文按整词并转小写', () => {
    expect(extractFeatures('使用 HashMap 存储')).toContain('hashmap')
  })

  it('过滤停用词', () => {
    expect(extractFeatures('的')).not.toContain('的')
  })

  it('丢弃单字符英文词', () => {
    expect(extractFeatures('a b c')).toEqual([])
  })
})

describe('createEmbeddingProvider', () => {
  it('同文本位级相等（可复现性核心断言）', () => {
    const a = provider.embed('Python 的多态通过鸭子类型实现')
    const b = provider.embed('Python 的多态通过鸭子类型实现')
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('两次独立调用结果完全相同（不受 Map 遍历顺序影响）', () => {
    const first = Array.from(provider.embedBatch(['索引与检索', '事务与隔离级别']).flatMap(v => Array.from(v)))
    const second = Array.from(provider.embedBatch(['索引与检索', '事务与隔离级别']).flatMap(v => Array.from(v)))
    expect(first).toEqual(second)
  })

  it('L2 范数为 1', () => {
    expect(l2Norm(provider.embed('数据库索引'))).toBeCloseTo(1, 5)
  })

  it('中英混合文本非全零', () => {
    const v = provider.embed('使用 HashMap 实现缓存')
    expect(Array.from(v).some(x => x !== 0)).toBe(true)
  })

  it('空文本与纯符号文本返回零向量且不抛错', () => {
    expect(Array.from(provider.embed('')).every(x => x === 0)).toBe(true)
    expect(Array.from(provider.embed('，。；')).every(x => x === 0)).toBe(true)
  })

  it('idf 长度必须与 dim 一致', () => {
    expect(() => createEmbeddingProvider({ dim: 8, idf: [1, 1] })).toThrow()
    expect(() => createEmbeddingProvider({ dim: 0, idf: [] })).toThrow()
  })

  it('非均匀 idf 会改变向量方向（证明确实消费了注入的权重）', () => {
    const text = '索引失效的常见原因'
    const flat = createEmbeddingProvider({ dim: DIM, idf: new Array(DIM).fill(1) })
    // 放大该文本真实命中的那个桶：非均匀权重才会改变 L2 归一化后的方向
    const hit = extractFeatures(text).map(f => fnv1a(f) % DIM)
    expect(hit.length).toBeGreaterThan(0)
    const skewed = new Array(DIM).fill(1)
    // 只放大前 3 个命中的桶：若全部放大就等价于整体缩放，归一化后方向不变
    for (const bucket of new Set(hit.slice(0, 3))) skewed[bucket] = 50
    const boosted = createEmbeddingProvider({ dim: DIM, idf: skewed })
    const a = flat.embed(text)
    const b = boosted.embed(text)
    expect(Array.from(a)).not.toEqual(Array.from(b))
    let dot = 0
    for (let i = 0; i < DIM; i++) dot += a[i] * b[i]
    expect(dot).toBeLessThan(0.999)
  })

  it('整体等比缩放的 idf 不改变向量方向（归一化的必然结果）', () => {
    const text = '索引失效的常见原因'
    const a = createEmbeddingProvider({ dim: DIM, idf: new Array(DIM).fill(1) }).embed(text)
    const b = createEmbeddingProvider({ dim: DIM, idf: new Array(DIM).fill(5) }).embed(text)
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})
