/**
 * @file llm.ts
 * @description LLM（大语言模型）聊天补全服务。
 *
 * 面向 OpenAI 兼容的 chat-completions 接口，提供流式（SSE）与非流式
 * 两种调用方式，支持工具调用（function calling）。负责消息格式化、
 * 请求体构建、SSE 解析与工具调用增量合并。
 */
import { fetch } from '@tauri-apps/plugin-http'
import type { Message, Tool, ToolCall, ProviderConfig } from '~/types'
import { SSEBuffer, parseToolCallDelta } from './sse-parser'
import type { ToolCallDelta } from './sse-parser'

/**
 * 流式与非流式聊天补全调用共享的参数。
 */
export interface StreamChatParams {
  messages: Message[]
  tools?: Tool[]
  providerConfig: ProviderConfig
  characterSystemPrompt: string
}

/**
 * 流式聊天补全过程中产出的单个数据块。
 */
export interface StreamChunk {
  content: string
  toolCalls: ToolCall[]
  isDone: boolean
}

/**
 * OpenAI 兼容的消息载荷。
 */
interface OpenAIMessage {
  role: string
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

/**
 * 将 Message 格式化为 OpenAI chat-completions API 所需的消息。
 */
function formatMessage(message: Message): OpenAIMessage {
  switch (message.role) {
    case 'user':
    case 'assistant': {
      const base: OpenAIMessage = {
        role: message.role,
        content: message.content,
      }
      if (message.toolCalls && message.toolCalls.length > 0) {
        base.tool_calls = message.toolCalls
      }
      return base
    }
    case 'tool':
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId ?? '',
        name: message.toolName ?? '',
      }
    case 'system':
      return { role: 'system', content: message.content }
    default:
      return { role: message.role, content: message.content }
  }
}

/**
 * 将工具列表格式化为 OpenAI 的 tools 载荷。无可用工具时返回 null。
 */
function formatTools(tools?: Tool[]): { type: 'function'; function: Tool }[] | null {
  if (!tools || tools.length === 0) return null
  return tools.map((tool) => ({ type: 'function' as const, function: tool }))
}

/**
 * 构建聊天补全接口的请求体。
 */
function buildRequestBody(params: StreamChatParams, stream: true): Record<string, unknown>
function buildRequestBody(params: StreamChatParams, stream: false): Record<string, unknown>
function buildRequestBody(params: StreamChatParams, stream: boolean): Record<string, unknown> {
  const { messages, tools, providerConfig, characterSystemPrompt } = params

  const formattedMessages: OpenAIMessage[] = [
    { role: 'system', content: characterSystemPrompt },
    ...messages.map(formatMessage),
  ]

  const body: Record<string, unknown> = {
    model: providerConfig.model,
    messages: formattedMessages,
    temperature: 0.7,
    max_tokens: 100,  // 限制回复长度，适合日常对话
    stream,
  }

  const toolsFormatted = formatTools(tools)
  if (toolsFormatted) {
    body.tools = toolsFormatted
  }

  return body
}

/**
 * 构建聊天补全请求的请求头。
 */
function buildHeaders(providerConfig: ProviderConfig, stream: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${providerConfig.apiKey}`,
  }
  if (stream) {
    headers.Accept = 'text/event-stream'
  }
  return headers
}

/**
 * 以异步生成器形式流式产出聊天补全结果。
 *
 * 随 SSE 数据块到达，逐段产出增量内容与累积的工具调用。
 * 最后一个产出的数据块 `isDone` 为 true。
 *
 * @throws HTTP 非 2xx 响应时抛出错误（消息体为响应正文）。
 */
export async function* streamChatCompletion(
  params: StreamChatParams,
): AsyncGenerator<StreamChunk> {
  const { providerConfig } = params
  const url = `${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(providerConfig, true),
    body: JSON.stringify(buildRequestBody(params, true)),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`LLM request failed (${response.status}): ${errText}`)
  }

  if (!response.body) {
    throw new Error('LLM stream response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const sseBuffer = new SSEBuffer()
  const toolCallAccumulator = new Map<number, ToolCall>()
  let accumulatedToolCalls: ToolCall[] = []

  let done = false
  try {
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      if (readerDone) {
        done = true
      }

      if (!value) {
        if (!readerDone) continue
        break
      }

      const text = decoder.decode(value, { stream: !readerDone })
      const parsedLines = sseBuffer.push(text)

      for (const line of parsedLines) {
        if (line.isDone) {
          yield {
            content: '',
            toolCalls: accumulatedToolCalls,
            isDone: true,
          }
          return
        }

        let json: unknown
        try {
          json = JSON.parse(line.data)
        } catch {
          continue
        }

        const parsed = json as {
          choices?: Array<{
            delta?: {
              content?: string
              tool_calls?: unknown
            }
            finish_reason?: string | null
          }>
        }

        const choice = parsed.choices?.[0]
        if (!choice) continue

        const delta = choice.delta
        let content = ''
        if (delta?.content) {
          content = delta.content
        }

        if (delta?.tool_calls) {
          accumulatedToolCalls = parseToolCallDelta(
            delta.tool_calls as Parameters<typeof parseToolCallDelta>[0],
            toolCallAccumulator,
          )
        }

        const isFinalChunk = choice.finish_reason != null
        if (content || isFinalChunk) {
          yield {
            content,
            toolCalls: accumulatedToolCalls,
            isDone: isFinalChunk,
          }
        }
      }
    }

    // 若退出循环时未收到 [DONE] 标记，则产出一个最终的完成数据块，
    // 以便调用方收尾。
    yield {
      content: '',
      toolCalls: accumulatedToolCalls,
      isDone: true,
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
    }
  }
}

/**
 * 非流式聊天补全。
 *
 * @returns 解析后的消息内容与响应中的工具调用。
 * @throws HTTP 非 2xx 响应时抛出错误（消息体为响应正文）。
 */
export async function chatCompletion(
  params: StreamChatParams,
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const { providerConfig } = params
  const url = `${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(providerConfig, false),
    body: JSON.stringify(buildRequestBody(params, false)),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`LLM request failed (${response.status}): ${errText}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string
        tool_calls?: ToolCall[]
      }
    }>
  }

  const message = data.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
  }
}
