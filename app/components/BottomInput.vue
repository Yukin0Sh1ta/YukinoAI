<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useChatStore } from '~/stores/chat'

const chatStore = useChatStore()
const text = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

/** 发送事件定义：携带消息内容 */
const emit = defineEmits<{
  send: [content: string]
}>()

/** 处理键盘事件：回车（非 Shift）时触发发送 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const content = text.value.trim()
  if (!content || chatStore.isStreaming) return
  emit('send', content)
  text.value = ''
}
</script>

<!--
  BottomInput.vue - 底部输入框组件
  - 提供文本输入与发送按钮，支持回车发送
  - 流式回复期间禁用输入
-->
<template>
  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/4 min-w-45 flex gap-1.5 items-center z-100">
    <input
      ref="inputRef"
      v-model="text"
      class="flex-1 px-3 py-1 border border-white/15 rounded-[20px] bg-[rgba(30,30,40,0.92)] backdrop-blur-md text-[#e8e8e8] text-sm outline-none font-sans transition-colors focus:border-[#6a8cab]/60 placeholder:text-white/35 disabled:opacity-50 disabled:cursor-not-allowed"
      type="text"
      placeholder="输入消息..."
      :disabled="chatStore.isStreaming"
      @keydown="handleKeydown"
    />
    <button
      class="shrink-0 w-6.5 h-6 border-none rounded-full bg-[rgba(66,133,244,0.9)] text-white cursor-pointer flex items-center justify-center transition-colors hover:bg-[rgba(66,133,244,1)] disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!text.trim() || chatStore.isStreaming"
      @click="handleSend"
    >
      <svg width="15" height="15" viewBox="0 0 14 14">
        <path d="M2 7 L12 7 M8 3 L12 7 L8 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>


