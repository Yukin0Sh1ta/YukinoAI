/**
 * @file 对话 Store
 * @description 管理对话列表、当前对话与消息数组，提供创建、选择、删除对话
 *              以及增删改消息等操作。持久化由 SQL 层负责，本 Store 仅维护内存状态。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Conversation, Message } from '~/types'

/**
 * 生成 UUID v4。优先使用 crypto.randomUUID，
 * 不可用时回退到手动实现的 RFC 4122 v4 生成器。
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 手动回退方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 对话 Store，管理对话列表、当前对话与消息数组 */
export const useConversationStore = defineStore('conversation', () => {
  // --- 状态 ---
  const conversations = ref<Conversation[]>([])
  const currentConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])

  // --- Actions ---

  /**
   * 为给定角色创建新对话，设为当前对话并加入列表。
   * 同时清空消息数组。
   */
  function createConversation(characterId: string): Conversation {
    const now = Date.now()
    const conv: Conversation = {
      id: uuid(),
      characterId,
      title: '新对话',
      createdAt: now,
      updatedAt: now,
    }
    conversations.value.push(conv)
    currentConversation.value = conv
    messages.value = []
    return conv
  }

  /**
   * 按 id 选择已有对话并将其设为当前对话。
   * 不负责从持久层加载消息 —— 那是 SQL 层的职责。
   */
  function selectConversation(id: string) {
    const found = conversations.value.find((c) => c.id === id)
    if (found) {
      currentConversation.value = found
      messages.value = []
    } else {
      console.warn(`[conversation] Conversation "${id}" not found`)
    }
  }

  /**
   * 按 id 从列表中删除对话。
   * 若被删的是当前对话，则清空当前对话与消息。
   */
  function deleteConversation(id: string) {
    const idx = conversations.value.findIndex((c) => c.id === id)
    if (idx === -1) return
    conversations.value.splice(idx, 1)
    if (currentConversation.value?.id === id) {
      currentConversation.value = null
      messages.value = []
    }
  }

  /**
   * 将一条消息追加到消息数组。
   */
  function addMessage(msg: Message) {
    messages.value.push(msg)
    if (currentConversation.value) {
      currentConversation.value.updatedAt = Date.now()
    }
  }

  /**
   * 按 id 查找消息，并将部分更新合并到该消息中。
   */
  function updateMessage(id: string, partial: Partial<Message>) {
    const idx = messages.value.findIndex((m) => m.id === id)
    const prev = idx !== -1 ? messages.value[idx] : undefined
    if (idx !== -1 && prev) {
      messages.value[idx] = { ...prev, ...partial, id: prev.id, conversationId: prev.conversationId, role: prev.role, content: partial.content ?? prev.content, createdAt: prev.createdAt }
    }
  }

  /**
   * 清空所有消息（例如切换对话时）。
   */
  function clearMessages() {
    messages.value = []
  }

  return {
    // state
    conversations,
    currentConversation,
    messages,
    // actions
    createConversation,
    selectConversation,
    deleteConversation,
    addMessage,
    updateMessage,
    clearMessages,
  }
})
