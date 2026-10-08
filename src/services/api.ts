import axios from 'axios';

// DeepSeek API 配置 - OpenAI 兼容格式
// API Key 从环境变量读取：复制 .env.example 为 .env.local 并填入真实 Key
// （.env.local 匹配 .gitignore 的 *.local，不会被提交）
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const BASE_URL = '/deepseek/v1';
const MODEL = import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-flash';

if (!API_KEY && import.meta.env.DEV) {
  console.warn(
    '[api] 未配置 VITE_DEEPSEEK_API_KEY，请在 .env.local 中填入 DeepSeek API Key（参考 .env.example）。',
  );
}

// 创建 axios 实例（非流式请求用）
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  },
  timeout: 180000, // 3分钟
});

// 消息类型 - OpenAI 兼容格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 请求体格式
interface ChatRequest {
  model: string;
  max_tokens: number;
  messages: { role: string; content: string }[];
  stream?: boolean;
}

// 流式回调类型：isThinking 为 true 时表示内容来自深度思考
export type StreamingCallback = (chunk: string, isThinking: boolean) => void;

/** 把 ChatMessage[] 转为 OpenAI 格式：system 消息保留在 messages 数组中 */
function toOpenAIMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

/** 解析错误响应体，取出可读的错误信息 */
async function extractErrorMessage(response: Response): Promise<string> {
  const errorData = await response.json().catch(() => ({}));
  const message =
    errorData?.error?.message ||
    errorData?.base_resp?.status_msg ||
    errorData?.message ||
    response.statusText;
  return message || '未知错误';
}

// ==================== 流式调用 ====================

/**
 * 流式调用大模型 - 基于 Fetch API 实现真正的流式响应
 *
 * DeepSeek 的 SSE 事件格式（OpenAI 兼容）：
 * - 正文增量：choices[0].delta.content
 * - 深度思考增量：choices[0].delta.reasoning_content
 * - 结束标记：data: [DONE]
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk?: StreamingCallback,
  onThinking?: (thinking: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const requestData: ChatRequest = {
    model: MODEL,
    max_tokens: 8192,
    messages: toOpenAIMessages(messages),
    stream: true,
  };

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestData),
      signal,
    });

    if (!response.ok) {
      const message = await extractErrorMessage(response);
      throw new Error(`API Error ${response.status}: ${message}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let thinkingStarted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;

        const payload = line.slice('data:'.length).trim();
        if (!payload) continue;
        // 结束标记
        if (payload === '[DONE]') break;

        try {
          const data = JSON.parse(payload);
          const delta = data?.choices?.[0]?.delta;
          if (!delta) continue;

          // 深度思考内容
          if (delta.reasoning_content) {
            if (!thinkingStarted) {
              thinkingStarted = true;
              onChunk?.('[思考中...]', true);
            }
            onThinking?.(delta.reasoning_content);
            onChunk?.(delta.reasoning_content, true);
          }
          // 正文内容
          else if (delta.content) {
            onChunk?.(delta.content, false);
            fullContent += delta.content;
          }
        } catch {
          // 忽略解析错误，继续处理下一行
        }
      }
    }

    return fullContent || '[无内容返回]';

  } catch (error: unknown) {
    console.error('Stream API call failed:', error);
    throw error;
  }
}

// ==================== 非流式调用 ====================

/**
 * 调用大模型进行对话（非流式，兼容旧代码）
 */
export async function chatCompletion(
  messages: ChatMessage[]
): Promise<string> {
  let lastError: unknown = null;

  // 最多重试3次
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const requestData: ChatRequest = {
        model: MODEL,
        max_tokens: 8192,
        messages: toOpenAIMessages(messages),
        stream: false,
      };

      console.log(`[API Attempt ${attempt}] Sending request...`);
      const response = await apiClient.post('/chat/completions', requestData);

      console.log('[API Response Raw]:', JSON.stringify(response.data, null, 2).substring(0, 500));

      const result = response.data;

      // 检查错误响应（OpenAI 兼容格式）
      if (result.error) {
        throw new Error(`API Error: ${result.error.type || 'unknown'} - ${result.error.message}`);
      }

      // 解析 OpenAI 格式的响应
      const message = result.choices?.[0]?.message;
      if (message) {
        if (message.reasoning_content) {
          console.log('[Reasoning]:', String(message.reasoning_content).substring(0, 100) + '...');
        }
        if (message.content) {
          return message.content;
        }
        throw new Error('Invalid response format, message.content is empty');
      }

      throw new Error(`Invalid response format, no choices found: ${JSON.stringify(result).substring(0, 200)}`);

    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error(`[API Attempt ${attempt} Failed]:`, err.message ?? err);
      lastError = error;

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('API call failed after 3 attempts');
}

export default apiClient;
