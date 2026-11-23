/**
 * @file useChat.ts
 * @description 聊天编排组合式函数。
 *
 * 将 LLM 流式服务、工具调用执行、Pinia 状态管理与 SQLite 持久化层
 * 整合为一个 `sendMessage` 入口，完成"用户发送消息 → 流式接收助手回复 →
 * 执行工具调用 → 持久化"的完整流程，并同步驱动 Live2D 的说话状态。
 */
import { useSettingsStore } from '~/stores/settings'
import { useCharacterStore } from '~/stores/character'
import { useConversationStore } from '~/stores/conversation'
import { useChatStore } from '~/stores/chat'
import { useLive2DStore } from '~/stores/live2d'
import { streamChatCompletion } from '~/services/llm'
import { executeToolCall, TOOL_DEFINITIONS } from '~/tools'
import {
  createConversation as dbCreateConversation,
  saveMessage,
} from '~/services/db'
import type { Message, ToolCall } from '~/types'

/** 单次用户消息允许的工具调用轮数上限，防止模型陷入无限循环。 */
const MAX_TOOL_ROUNDS = 8

/**
 * 生成 UUID。当 crypto.randomUUID 不可用时，回退为"时间戳 + 随机数"形式的 id。
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * 聊天编排组合式函数。
 *
 * 将 LLM 流式服务、工具调用执行、Pinia 状态管理与 SQLite 持久化层
 * 整合为一个 `sendMessage` 入口。
 *
 * 流程：
 *  1. 确保存在当前对话（先在数据库中创建，再将 store 同步到数据库生成的 id）。
 *  2. 将用户消息添加到 store 与数据库。
 *  3. 流式接收助手的回复。
 *  4. 持久化助手消息。
 *  5. 若助手请求了工具调用：逐个执行，持久化工具结果消息，
 *     然后回到第 3 步（使用 `while` 循环，而非递归）。
 *  6. 全程驱动 Live2D 的说话状态。
 */
export function useChat() {
  const settingsStore = useSettingsStore()
  const characterStore = useCharacterStore()
  const conversationStore = useConversationStore()
  const chatStore = useChatStore()
  const live2dStore = useLive2DStore()

  /**
   * 确保存在当前对话。
   *
   * 数据库的 `createConversation` 会自行生成 id；为避免 store 与数据库
   * 的 id 不一致，我们先在数据库中创建，再手动设置 store 的
   * `currentConversation` 并推入 conversations 列表
   * （而非调用 store 的 `createConversation`）。
   */
  async function ensureConversation(): Promise<string> {
    if (conversationStore.currentConversation) {
      return conversationStore.currentConversation.id
    }

    const characterId = characterStore.current.id
    const dbConv = await dbCreateConversation(characterId, '新对话')

    // 将 store 同步到数据库对话——不要使用 store.createConversation
    conversationStore.currentConversation = dbConv
    conversationStore.conversations.push(dbConv)
    conversationStore.clearMessages()

    return dbConv.id
  }

  /**
   * 将消息持久化到数据库，错误被静默吞掉，保证数据库不可用
   * （例如浏览器开发环境）时内存中的聊天仍能正常工作。
   */
  async function persistMessage(msg: Message): Promise<void> {
    try {
      await saveMessage(msg)
    } catch (e) {
      console.warn('[useChat] Failed to persist message:', e)
    }
  }

  /**
   * 发送用户消息并流式接收助手回复，通过 while 循环处理工具调用，
   * 直到助手产出最终回答为止。
   */
  async function sendMessage(content: string): Promise<void> {
    if (!settingsStore.isConfigured) {
      chatStore.setError('请先配置 API Key')
      return
    }

    // 1. 确保存在对话
    let convId: string
    try {
      convId = await ensureConversation()
    } catch (e) {
      chatStore.setError(`创建对话失败: ${String(e)}`)
      return
    }

    // 2. 将用户消息添加到 store 与数据库
    const userMsg: Message = {
      id: generateId(),
      conversationId: convId,
      role: 'user',
      content,
      createdAt: Date.now(),
    }
    conversationStore.addMessage(userMsg)
    await persistMessage(userMsg)

    // 3. 流式接收 + 工具调用循环
    chatStore.startStreaming()
    live2dStore.setSpeaking(true)

    try {
      let pendingToolCalls: ToolCall[] = []
      let toolRounds = 0

      do {
        // 重置本轮的累加器
        let assistantContent = ''
        pendingToolCalls = []

        const stream = streamChatCompletion({
          messages: [...conversationStore.messages],
          tools: TOOL_DEFINITIONS,
          providerConfig: settingsStore.provider,
          characterSystemPrompt: characterStore.current.systemPrompt,
        })

        for await (const chunk of stream) {
          if (chunk.content) {
            chatStore.appendContent(chunk.content)
            assistantContent += chunk.content
          }
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            chatStore.setStreamingToolCalls(chunk.toolCalls)
            pendingToolCalls = chunk.toolCalls
          }
          if (chunk.isDone) break
        }

        // 持久化助手消息
        const assistantMsg: Message = {
          id: generateId(),
          conversationId: convId,
          role: 'assistant',
          content: assistantContent,
          toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
          createdAt: Date.now(),
        }
        conversationStore.addMessage(assistantMsg)
        await persistMessage(assistantMsg)

        // 没有工具调用 → 完成
        if (pendingToolCalls.length === 0) {
          break
        }

        // 达到工具调用轮数上限 → 停止循环并告知用户
        if (toolRounds >= MAX_TOOL_ROUNDS) {
          const limitMsg: Message = {
            id: generateId(),
            conversationId: convId,
            role: 'system',
            content: `工具调用次数已达上限（${MAX_TOOL_ROUNDS} 轮），已停止继续调用工具。请基于现有信息直接回答用户。`,
            createdAt: Date.now(),
          }
          conversationStore.addMessage(limitMsg)
          await persistMessage(limitMsg)
          break
        }
        toolRounds++

        // 逐个执行工具调用并持久化结果
        for (const toolCall of pendingToolCalls) {
          const result = await executeToolCall(toolCall)
          const toolMsg: Message = {
            id: generateId(),
            conversationId: convId,
            role: 'tool',
            // 失败时把错误信息回传给模型，避免其看不到失败原因而无限重试
            content: result.success
              ? result.result
              : JSON.stringify({ error: result.error ?? 'tool failed' }),
            toolCallId: result.toolCallId,
            toolName: result.toolName,
            createdAt: Date.now(),
          }
          conversationStore.addMessage(toolMsg)
          await persistMessage(toolMsg)
        }

        // 为下一轮重置流式状态（工具结果现已存入
        // conversationStore.messages，LLM 将能看到它们）。
        chatStore.startStreaming()
      } while (pendingToolCalls.length > 0)
    } catch (e) {
      chatStore.setError(String(e))
    } finally {
      chatStore.stopStreaming()
      live2dStore.setSpeaking(false)
    }
  }

  return { sendMessage }
}
