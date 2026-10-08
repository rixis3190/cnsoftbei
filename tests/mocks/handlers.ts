/**
 * handlers.ts
 *
 * msw 请求处理器 — 拦截 DeepSeek API 调用并返回 mock 响应（OpenAI 兼容格式）
 */
import { http, HttpResponse, delay } from 'msw'

const BASE_URL = '/deepseek/v1'

// 构建 SSE 流式响应（OpenAI 兼容：choices[].delta.content，结束标记 data: [DONE]）
function createSSEResponse(text: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n\n`)
      )

      // 分块发送文本
      const chunks = text.match(/.{1,20}/g) || [text]
      for (const chunk of chunks) {
        await delay(10)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`)
        )
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

// 构建非流式响应（OpenAI 兼容格式）
function createSyncResponse(text: string) {
  return HttpResponse.json({
    id: 'mock-msg-001',
    object: 'chat.completion',
    created: Date.now(),
    model: 'deepseek-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      },
    ],
  })
}

// 根据 system prompt 内容分发不同 mock 响应
function getResponseForPrompt(systemPrompt: string): string {
  // 判分相关
  if (systemPrompt.includes('评分标准') || systemPrompt.includes('评估专家')) {
    return '85'
  }
  // 画像分析
  if (systemPrompt.includes('画像') || systemPrompt.includes('学习者')) {
    return JSON.stringify({
      knowledgeBase: '中级',
      cognitiveStyle: '文字型',
      errorProne: '低',
      learningPace: '中等',
      interestDirection: '前端开发',
      studyHabit: '边做边学',
    })
  }
  // 相关性检查
  if (systemPrompt.includes('相关') || systemPrompt.includes('主题')) {
    return '相关'
  }
  // 质量评审
  if (systemPrompt.includes('评审') || systemPrompt.includes('质量')) {
    return '80'
  }
  // 默认返回
  return '这是一个模拟的 AI 回答，用于测试目的。'
}

interface Message { role: string; content: string }
interface RequestBody { messages?: Message[]; stream?: boolean }

export const handlers = [
  // 流式 / 非流式统一入口
  http.post(`${BASE_URL}/chat/completions`, async ({ request }) => {
    const body = (await request.json()) as RequestBody
    const systemMsg = body.messages?.find((m: Message) => m.role === 'system')
    const systemPrompt = systemMsg?.content || ''

    const responseText = getResponseForPrompt(systemPrompt)

    if (body.stream) {
      return createSSEResponse(responseText)
    }
    return createSyncResponse(responseText)
  }),
]
