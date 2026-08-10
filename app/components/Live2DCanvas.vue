<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useLive2D } from '~/composables/useLive2D'

const props = defineProps<{
  modelPath: string
  speaking?: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { loadModel, startSpeaking, stopSpeaking, destroy, isReady, error } =
  useLive2D(canvasRef)

/** 监听模型路径变化：就绪后重新加载新模型 */
watch(
  () => props.modelPath,
  async (path) => {
    if (path && isReady.value) {
      await loadModel(path)
    }
  },
)

/** 监听说话状态变化：开始 / 停止说话动画 */
watch(
  () => props.speaking,
  (speaking) => {
    if (speaking) startSpeaking()
    else stopSpeaking()
  },
)

/** 组件挂载：加载初始模型，若初始为说话状态则开始说话动画 */
onMounted(async () => {
  if (props.modelPath) {
    await loadModel(props.modelPath)
  }
  if (props.speaking) startSpeaking()
})

/** 组件卸载：销毁 Live2D 实例释放资源 */
onUnmounted(() => {
  destroy()
})
</script>

<!--
  Live2DCanvas.vue - Live2D 角色画布组件
  - 渲染 Live2D 模型到 canvas 元素
  - 支持模型路径动态切换与说话状态切换
  - 加载中 / 错误时显示提示信息
-->
<template>
  <!-- 画布容器：在窗口内居中并留出边距 -->
  <div class="absolute top-7.5 bottom-15 left-5 right-5 w-auto h-auto bg-transparent overflow-hidden">
    <!-- Live2D 渲染画布 -->
    <canvas ref="canvasRef" class="block w-full h-full bg-transparent pointer-events-none" />
    <!-- 加载 / 错误提示层：模型未就绪时显示 -->
    <div v-if="!isReady" class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none text-white/70 text-sm font-sans p-5 text-center">
      <!-- 错误信息 -->
      <span v-if="error" class="text-red-400/90 text-xs wrap-break-word leading-relaxed">{{ error }}</span>
      <!-- 加载中提示 -->
      <span v-else>Loading...</span>
    </div>
  </div>
</template>


