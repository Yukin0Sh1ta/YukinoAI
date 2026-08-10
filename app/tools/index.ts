/**
 * @file 工具执行入口
 * @description 对外暴露工具注册表（registry）的导出，并提供执行单次 LLM 工具调用的
 *              executeToolCall 函数，依据工具名查找执行器并返回结构化结果。
 */
export * from './registry'
import type { ToolCall, ToolCallResult } from '~/types'
import { TOOL_EXECUTORS } from './registry'


/**
 * 执行单次 LLM 工具调用并返回 ToolCallResult。
 * 找不到工具或执行异常时返回带错误信息的结果。
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
  const executor = TOOL_EXECUTORS[toolCall.function.name]
  if (!executor) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      args: {},
      result: '',
      success: false,
      error: `Unknown tool: ${toolCall.function.name}`,
    }
  }
  try {
    const args = JSON.parse(toolCall.function.arguments || '{}')
    const result = await executor(args)
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      args,
      result,
      success: true,
    }
  } catch (e) {
    return {
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      args: {},
      result: '',
      success: false,
      error: String(e),
    }
  }
}
