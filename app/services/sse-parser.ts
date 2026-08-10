/**
 * @file sse-parser.ts
 * @description SSE（Server-Sent Events）流解析与工具调用增量合并工具。
 *
 * 提供 SSEBuffer 用于按行解析 `data:` 数据块（兼容 \n 与 \r\n），
 * 以及 parseToolCallDelta 用于将流式分片的工具调用按 index 合并
 * 为完整的 ToolCall 数组。
 */
import type { ToolCall } from '~/types'

/**
 * 解析后的一行 SSE 数据。
 */
export interface SSEParsedLine {
  data: string
  isDone: boolean
}

/**
 * 增量式 SSE 行缓冲区。
 *
 * 向缓冲区 push 原始字符串分片；完整的 `data:` 行会从 `push()` 返回。
 * 末尾的不完整行会被内部保留，等待下一次 `push()` 再处理。
 * 同时兼容 `\n` 与 `\r\n` 行尾。
 */
export class SSEBuffer {
  private buffer = ''

  /**
   * 向缓冲区推入一段原始文本，返回其中解析出的完整 SSE 数据行。
   * @param chunk 原始字符串分片
   * @returns 解析出的完整数据行数组
   */
  push(chunk: string): SSEParsedLine[] {
    this.buffer += chunk
    const results: SSEParsedLine[] = []
    const lines = this.buffer.split('\n')
    // 最后一个元素要么是 ''（完整行尾），要么是不完整的一行。
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      // 去掉末尾的 \r（兼容 CRLF）以及首尾空白。
      const trimmed = line.replace(/\r$/, '').trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      results.push({ data, isDone: data === '[DONE]' })
    }
    return results
  }

  /** 剩余的不完整行文本（用于调试/刷新）。 */
  get remaining(): string {
    return this.buffer
  }
}

/**
 * OpenAI 兼容 API 流式工具调用分片的原始结构。
 */
export interface ToolCallDelta {
  index?: number
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

/**
 * 将 `delta.tool_calls` 数组按 index 合并到累加器中。
 *
 * 流式协议以分片形式发送工具调用：某个 index 的第一个分片通常携带
 * `id` + `function.name`，后续分片则携带 `function.arguments` 的片段，
 * 必须拼接起来。
 *
 * @param delta 单个 SSE 数据块中的原始 `choices[0].delta.tool_calls` 数组
 * @param accumulator 以工具调用 index 为键的累加 Map → 累积的 ToolCall
 * @returns 当前已累积的 ToolCall 快照数组（即 Map 的值）
 */
export function parseToolCallDelta(
  delta: ToolCallDelta[] | undefined,
  accumulator: Map<number, ToolCall>,
): ToolCall[] {
  if (!delta || !Array.isArray(delta)) return Array.from(accumulator.values())

  for (const piece of delta) {
    if (!piece) continue
    const index = piece.index ?? 0
    const existing = accumulator.get(index)

    if (existing) {
      // 拼接参数片段；若提供了 name 则更新。
      if (piece.function?.arguments) {
        existing.function.arguments += piece.function.arguments
      }
      if (piece.function?.name) {
        existing.function.name = piece.function.name
      }
      // id 通常已设置，但此处防御性更新。
      if (piece.id) {
        existing.id = piece.id
      }
    } else {
      // 新的工具调用。在纯参数分片中 id 与 name 可能缺失，
      // 但按规范某个 index 的首个分片会携带它们。
      accumulator.set(index, {
        id: piece.id ?? '',
        type: 'function',
        function: {
          name: piece.function?.name ?? '',
          arguments: piece.function?.arguments ?? '',
        },
      })
    }
  }

  return Array.from(accumulator.values())
}
