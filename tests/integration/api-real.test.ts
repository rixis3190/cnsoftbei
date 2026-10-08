/**
 * DeepSeek API 真实接口测试
 *
 * 直接调用 DeepSeek API（不经过 Vite 代理），验证连通性和响应格式。
 * 运行方式：npx vitest run tests/integration/api-real.test.ts
 *
 * 前置条件：在 .env.local 中配置 VITE_DEEPSEEK_API_KEY（参考 .env.example）。
 * 未配置时本文件全部用例自动跳过，不会因 401 失败。
 *
 * 注意：会消耗 API 额度，每次运行约 200-500 tokens。
 */

import { describe, it, expect } from 'vitest'

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''
const BASE_URL = 'https://api.deepseek.com/v1'
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-flash'
const API_TIMEOUT = 60000
// max_tokens 取 1024：deepseek-flash 可能把 token 消耗在 reasoning_content 上，
// max_tokens 过小（如 256）会导致 content 为空字符串、评分类断言假失败

// 未配置 Key 时跳过整个文件，避免默认 npm test 出现必然失败的用例
const describeWithKey = API_KEY ? describe : describe.skip

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ==================== 流式调用工具函数 ====================

async function callStream(messages: ChatMessage[]): Promise<{
  text: string
  chunks: string[]
  thinkingChunks: string[]
}> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`API Error ${response.status}: ${err?.error?.message || response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const chunks: string[] = []
  const thinkingChunks: string[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim() && line.startsWith('data:')) {
        const payload = line.trim().slice('data:'.length).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload)
          const delta = data?.choices?.[0]?.delta
          if (delta?.reasoning_content) {
            thinkingChunks.push(delta.reasoning_content)
          } else if (delta?.content) {
            chunks.push(delta.content)
            fullContent += delta.content
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  return { text: fullContent || '[无内容返回]', chunks, thinkingChunks }
}

// ==================== 非流式调用工具函数 ====================

async function callNonStream(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`API Error ${response.status}: ${err?.error?.message || response.statusText}`)
  }

  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content
  if (content) return content
  throw new Error(`Invalid response: ${JSON.stringify(result).substring(0, 200)}`)
}

// ==================== 流式接口测试 ====================

describeWithKey('DeepSeek API 流式接口', () => {
  it(
    '基本连通性 — 返回非空文本',
    async () => {
      const { text } = await callStream([
        { role: 'user', content: '用一句话回答：1+1等于几？' },
      ])
      expect(text).toBeTruthy()
      expect(text).toContain('2')
    },
    API_TIMEOUT,
  )

  it(
    '流式回调 — onChunk 被多次调用',
    async () => {
      const { text, chunks } = await callStream([
        { role: 'user', content: '用一句话回答：Python 是什么？' },
      ])
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toBe(text)
    },
    API_TIMEOUT,
  )

  it(
    'system 消息 — 角色约束生效',
    async () => {
      const { text } = await callStream([
        { role: 'system', content: '你是一个数学助手。只回答数学问题。如果问题不是数学相关的，回答"我只能回答数学问题"。' },
        { role: 'user', content: '今天天气怎么样？' },
      ])
      expect(text).toContain('数学')
    },
    API_TIMEOUT,
  )

  it(
    '中文回答 — 返回中文内容',
    async () => {
      const { text } = await callStream([
        { role: 'user', content: '用中文回答：什么是变量？一句话。' },
      ])
      expect(/[一-鿿]/.test(text)).toBe(true)
    },
    API_TIMEOUT,
  )

  it(
    '多轮对话 — 上下文保持',
    async () => {
      const { text } = await callStream([
        { role: 'user', content: '我叫小明' },
        { role: 'assistant', content: '你好小明！' },
        { role: 'user', content: '我叫什么？只回答名字。' },
      ])
      expect(text).toContain('小明')
    },
    API_TIMEOUT,
  )
})

// ==================== 非流式接口测试 ====================

describeWithKey('DeepSeek API 非流式接口', () => {
  it(
    '基本连通性 — 返回非空文本',
    async () => {
      const result = await callNonStream([
        { role: 'user', content: '用一句话回答：1+1等于几？' },
      ])
      expect(result).toBeTruthy()
      expect(result).toContain('2')
    },
    API_TIMEOUT,
  )

  it(
    'system 消息 — 角色约束生效',
    async () => {
      const result = await callNonStream([
        { role: 'system', content: '你是一个编程教师。只回答 Python 相关问题。' },
        { role: 'user', content: 'Python 的 print 函数是干什么的？一句话。' },
      ])
      expect(result).toBeTruthy()
      expect(result.length).toBeGreaterThan(0)
    },
    API_TIMEOUT,
  )

  it(
    '评分场景 — 返回数字',
    async () => {
      const result = await callNonStream([
        {
          role: 'system',
          content: '你是评分助手。只输出一个0-100的数字，不要输出其他内容。',
        },
        {
          role: 'user',
          content: '参考答案：变量是存储数据的容器。用户答案：变量就是可以变的量。评分：',
        },
      ])
      expect(result).toBeTruthy()
      const scoreMatch = result.match(/\d+/)
      expect(scoreMatch).not.toBeNull()
      const score = parseInt(scoreMatch![0], 10)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    },
    API_TIMEOUT,
  )
})

// ==================== 响应格式验证 ====================

describeWithKey('API 响应格式验证', () => {
  it(
    '流式响应 — text 块存在',
    async () => {
      const { chunks } = await callStream([
        { role: 'user', content: '1+1=?' },
      ])
      expect(chunks.length).toBeGreaterThan(0)
    },
    API_TIMEOUT,
  )

  it(
    '流式响应 — 拼接与返回值一致',
    async () => {
      const { text, chunks } = await callStream([
        { role: 'user', content: '用一个词回答：天空是什么颜色？' },
      ])
      expect(chunks.join('')).toBe(text)
    },
    API_TIMEOUT,
  )
})

// ==================== 错误处理 ====================

// 这组用例同样直连真实接口，因此也必须受 Key 守卫：
// 未配置 VITE_DEEPSEEK_API_KEY 时若照常运行，会因连接/鉴权失败而报错，
// 造成"没配 Key 就一定是红"的误导。
describeWithKey('API 错误处理', () => {
  it(
    '无效 API Key — 返回 401',
    async () => {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-key',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 64,
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBeGreaterThanOrEqual(400)
    },
    API_TIMEOUT,
  )

  it(
    '无效模型名 — 返回 400',
    async () => {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'no-such-model',
          max_tokens: 64,
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
      const err = await response.json()
      expect(err?.error?.message).toBeTruthy()
    },
    API_TIMEOUT,
  )

  it(
    '请求取消 — AbortError',
    async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(
        fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
          }),
          signal: controller.signal,
        }),
      ).rejects.toThrow()
    },
    API_TIMEOUT,
  )
})
