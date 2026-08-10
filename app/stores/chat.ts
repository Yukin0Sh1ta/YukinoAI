/**
 * @file 聊天 Store
 * @description 管理流式聊天会话状态，包括流式输出中标志、正在接收的内容缓冲、
 *              流式过程中累积的工具调用，以及错误信息。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ToolCall } from '~/types'

/** 聊天 Store，管理流式聊天的临时状态与错误 */
export const useChatStore = defineStore('chat', () => {
  // --- 状态 ---
  const isStreaming = ref<boolean>(false)
  const streamingContent = ref<string>('')
  const streamingToolCalls = ref<ToolCall[]>([])
  const error = ref<string | null>(null)

  // --- Actions ---

  function startStreaming() {
    isStreaming.value = true
    streamingContent.value = ''
    streamingToolCalls.value = []
    error.value = null
  }

  /**
   * 将一个内容片段追加到流式内容缓冲。
   */
  function appendContent(chunk: string) {
    streamingContent.value += chunk
  }

  /**
   * 设置流式过程中累积的工具调用列表。
   */
  function setStreamingToolCalls(calls: ToolCall[]) {
    streamingToolCalls.value = calls
  }

  /**
   * 停止流式输出 —— 置 isStreaming 为 false。
   * 流式内容与工具调用仍可被消费方读取。
   */
  function stopStreaming() {
    isStreaming.value = false
  }

  function setError(msg: string) {
    error.value = msg
  }

  function clearError() {
    error.value = null
  }

  return {
    // state
    isStreaming,
    streamingContent,
    streamingToolCalls,
    error,
    // actions
    startStreaming,
    appendContent,
    setStreamingToolCalls,
    stopStreaming,
    setError,
    clearError,
  }
})
