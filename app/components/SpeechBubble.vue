<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useChatStore } from '~/stores/chat'

const chatStore = useChatStore()

const visible = ref(false)
const displayText = ref('')
let hideTimer: ReturnType<typeof setTimeout> | null = null

// 监听流式内容变化，逐字显示
watch(
  () => chatStore.streamingContent,
  (content) => {
    if (content) {
      visible.value = true
      displayText.value = content
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }
  },
)

// 监听流式结束，启动 5 秒自动消失
watch(
  () => chatStore.isStreaming,
  (streaming) => {
    if (!streaming && displayText.value) {
      // 回复完毕，5 秒后自动淡出
      hideTimer = setTimeout(() => {
        visible.value = false
      }, 5000)
    }
  },
)

// 监听错误，也显示在气泡中
watch(
  () => chatStore.error,
  (err) => {
    if (err) {
      visible.value = true
      displayText.value = err
      if (hideTimer) {
        clearTimeout(hideTimer)
      }
      hideTimer = setTimeout(() => {
        visible.value = false
      }, 5000)
    }
  },
)


function handleClick() {
  visible.value = false
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
})
</script>

<!--
  SpeechBubble.vue - AI 对话气泡组件
  - 在角色右侧显示流式回复内容（逐字显示）
  - 回复结束后 5 秒自动淡出消失
  - 支持点击立即关闭，错误信息也会在此展示
-->
<template>
  <Transition name="bubble">
    <div
      v-if="visible && displayText"
      class="absolute top-1/2 right-2 -translate-y-1/2 max-w-[45%] min-w-[60px] px-4 py-2.5 bg-[rgba(30,30,40,0.92)] backdrop-blur-md rounded-2xl text-white/92 text-sm leading-relaxed font-sans break-words cursor-pointer z-[100] shadow-lg"
      @click="handleClick"
    >
      <span class="whitespace-pre-wrap">{{ displayText }}</span>
      <span v-if="chatStore.isStreaming" class="inline-block ml-0.5 animate-blink text-[#a8c8ff] font-bold">|</span>
      <div class="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-[rgba(30,30,40,0.92)]" />
    </div>
  </Transition>
</template>

<style scoped>
/* 光标闪烁动画定义 */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.animate-blink {
  animation: blink 1s step-end infinite;
}

/* 淡入淡出动画 */
.bubble-enter-active,
.bubble-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(10px);
}
</style>
