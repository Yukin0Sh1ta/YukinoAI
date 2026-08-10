/**
 * @file Live2D Store
 * @description 管理 Live2D 模型相关运行时状态，包括模型加载状态、说话状态、
 *              嘴部张合程度（用于驱动口型动画）以及当前模型路径。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Live2D Store，管理 Live2D 模型的运行时状态 */
export const useLive2DStore = defineStore('live2d', () => {
  // --- 状态 ---
  const isLoaded = ref<boolean>(false)
  const isSpeaking = ref<boolean>(false)
  const mouthOpen = ref<number>(0)  // 0-1
  const modelPath = ref<string | null>(null)

  // --- Actions ---

  /**
   * 设置 Live2D 模型是否已完成加载。
   */
  function setLoaded(loaded: boolean) {
    isLoaded.value = loaded
  }

  /**
   * 设置角色当前是否正在说话（用于驱动口型动画）。
   */
  function setSpeaking(speaking: boolean) {
    isSpeaking.value = speaking
  }

  /**
   * 设置嘴部张开值（0 = 闭合，1 = 完全张开）。
   * 会被限制在 [0, 1] 区间。
   */
  function setMouthOpen(value: number) {
    mouthOpen.value = Math.max(0, Math.min(1, value))
  }

  /**
   * 设置当前已加载 Live2D 模型的路径。
   */
  function setModelPath(path: string | null) {
    modelPath.value = path
  }

  return {
    // state
    isLoaded,
    isSpeaking,
    mouthOpen,
    modelPath,
    // actions
    setLoaded,
    setSpeaking,
    setMouthOpen,
    setModelPath,
  }
})
