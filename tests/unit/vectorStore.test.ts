/**
 * vectorStore 单测（S2-7）
 * 重点：量化误差上限、编解码往返一致、topK 排序正确、base64 双端可用。
 */

import { describe, it, expect } from 'vitest'
import {
  base64ToBytes,
  bytesToBase64,
  cosineDot,
  decodeVectors,
  encodeVectors,
  normalizeL2,
  QUANT_SCALE,
  topK,
} from '../../src/embedding/vectorStore'

function unitVector(values: number[]): Float32Array {
  return normalizeL2(Float32Array.from(values))
}

describe('base64 编解码', () => {
  it('往返一致（含 0 与高位字节）', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42])
    const encoded = bytesToBase64(bytes)
    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(bytes))
  })

  it('空数组不抛错', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('')
    expect(base64ToBytes('').length).toBe(0)
  })

  it('长数组（>32KB）分片编码不爆栈', () => {
    const big = new Uint8Array(100000).fill(7)
    expect(base64ToBytes(bytesToBase64(big)).length).toBe(100000)
  })
})

describe('int8 量化', () => {
  it('编解码往返误差 ≤ 量化步长', () => {
    const vectors = [unitVector([1, 0, 0]), unitVector([0, 1, 0]), unitVector([0.6, 0.8, 0])]
    const restored = decodeVectors(encodeVectors(vectors), vectors.length, 3)
    for (let v = 0; v < vectors.length; v++) {
      for (let d = 0; d < 3; d++) {
        expect(Math.abs(restored[v][d] - vectors[v][d])).toBeLessThanOrEqual(1 / QUANT_SCALE)
      }
    }
  })

  it('解码后仍是单位向量', () => {
    const vectors = [unitVector([1, 1, 1])]
    const restored = decodeVectors(encodeVectors(vectors), 1, 3)
    const norm = Math.sqrt(restored[0].reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it('数据长度不匹配时抛错', () => {
    expect(() => decodeVectors(new Int8Array(4), 2, 3)).toThrow()
  })

  it('空向量组不抛错', () => {
    expect(decodeVectors(new Int8Array(0), 0, 4)).toEqual([])
  })

  it('零向量归一化后仍是零（不产生 NaN）', () => {
    const v = normalizeL2(new Float32Array([0, 0, 0]))
    expect(Array.from(v)).toEqual([0, 0, 0])
  })
})

describe('cosineDot / topK', () => {
  it('点积与手算一致', () => {
    const a = unitVector([1, 1, 0])
    const b = unitVector([1, 0, 0])
    const expected = (1 / Math.sqrt(2)) * 1
    expect(cosineDot(a, b)).toBeCloseTo(expected, 6)
  })

  it('维度不匹配时抛错', () => {
    expect(() => cosineDot(new Float32Array(2), new Float32Array(3))).toThrow()
  })

  it('topK 按分数降序返回', () => {
    const vectors = [
      unitVector([1, 0]),
      unitVector([0.9, 0.1]),
      unitVector([0, 1]),
      unitVector([0.1, 0.9]),
    ]
    const result = topK(unitVector([1, 0]), vectors, 2)
    expect(result.length).toBe(2)
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
    expect(result[0].score).toBeCloseTo(1, 5)
  })

  it('k 大于向量数时返回全部', () => {
    const result = topK(unitVector([1, 0]), [unitVector([1, 0])], 5)
    expect(result.length).toBe(1)
  })

  it('相同输入两次调用结果完全相同', () => {
    const vectors = Array.from({ length: 20 }, (_, i) => unitVector([i + 1, 1, 2]))
    const query = unitVector([1, 1, 1])
    const a = topK(query, vectors, 5)
    const b = topK(query, vectors, 5)
    expect(a).toEqual(b)
  })
})
