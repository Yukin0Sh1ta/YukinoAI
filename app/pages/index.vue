<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { useSettingsStore } from '~/stores/settings'
import { useCharacterStore } from '~/stores/character'
import { useLive2DStore } from '~/stores/live2d'
import { useChat } from '~/composables/useChat'
import { useWindowManager } from '~/composables/useWindowManager'
import { useWindowPosition } from '~/composables/useWindowPosition'
import { initDb } from '~/services/db'
import Live2DCanvas from '~/components/Live2DCanvas.vue'
import SpeechBubble from '~/components/SpeechBubble.vue'
import BottomInput from '~/components/BottomInput.vue'
import AiMenu from '~/components/AiMenu.vue'

const settingsStore = useSettingsStore()
const characterStore = useCharacterStore()
const live2dStore = useLive2DStore()

const { sendMessage } = useChat()
const { openSettings, hideWindow, quitApp, onOpenSettings, isFocused, trackFocus } = useWindowManager()
const { restore: restoreWindowPosition, save: saveWindowPosition } = useWindowPosition()

const showMenu = ref(false)
const showInput = ref(false)
const bottomInputRef = ref<InstanceType<typeof BottomInput> | null>(null)

let unlistenOpenSettings: (() => void) | null = null
let unlistenFocus: (() => void) | null = null
let unlistenSettingsSaved: (() => void) | null = null
let unlistenMoved: (() => void) | null = null
let moveSaveTimer: ReturnType<typeof setTimeout> | null = null

/** 处理发送消息：通过 chat 发送内容并隐藏菜单与输入框 */
function handleSend(content: string) {
  sendMessage(content)
  showMenu.value = false
  showInput.value = false
}

// /** 左键点击空白区域 → 仅拖动窗口，不隐藏菜单和聊天框 */
// function handleAiClick() {
//   // 不做任何关闭操作，只在 mousedown 时拖动
// }

/** mousedown 时同步调用 startDragging() 实现窗口拖动 */
function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return // 只响应左键
  if ((e.target as HTMLElement).closest('button, input, textarea, .ai-menu-overlay, .bottom-input, .speech-bubble')) return
  getCurrentWindow().startDragging()
}

async function handleContextMenu() {
  showMenu.value = !showMenu.value
  showInput.value = !showInput.value
}

function handleMenuSettings() {
  showMenu.value = false
  showInput.value = false
  openSettings()
}

function handleMenuHide() {
  showMenu.value = false
  showInput.value = false
  hideWindow()
}

function handleMenuBye() {
  showMenu.value = false
  showInput.value = false
  quitApp()
}

/** 组件挂载：加载设置、角色，初始化数据库，恢复窗口位置并监听焦点与设置打开事件 */
onMounted(async () => {
  await settingsStore.loadSettings()
  characterStore.loadCharacter(settingsStore.characterId)

  try {
    await initDb()
  } catch (e) {
    console.warn('[index] DB init failed:', e)
  }

  await restoreWindowPosition()

  try {
    unlistenFocus = await trackFocus()
  } catch (e) {
    console.warn('[index] Failed to track focus:', e)
  }

  try {
    unlistenOpenSettings = await onOpenSettings(() => {
      openSettings()
    })
  } catch (e) {
    console.warn('[index] Failed to register open-settings listener:', e)
  }

  try {
    unlistenSettingsSaved = await listen('settings-saved', async () => {
      await settingsStore.loadSettings()
      characterStore.loadCharacter(settingsStore.characterId)
    })
  } catch (e) {
    console.warn('[index] Failed to register settings-saved listener:', e)
  }

  // 窗口移动时防抖保存位置：Tauri 关窗/退出不会触发 Vue 卸载
  try {
    unlistenMoved = await getCurrentWindow().onMoved(() => {
      if (moveSaveTimer) clearTimeout(moveSaveTimer)
      moveSaveTimer = setTimeout(() => {
        moveSaveTimer = null
        void saveWindowPosition()
      }, 500)
    })
  } catch (e) {
    console.warn('[index] Failed to register window move listener:', e)
  }

  if (!settingsStore.isConfigured) {
    openSettings()
  }
})

/** 组件卸载：移除事件监听器并保存窗口位置 */
onUnmounted(() => {
  if (unlistenOpenSettings) {
    unlistenOpenSettings()
    unlistenOpenSettings = null
  }
  if (unlistenFocus) {
    unlistenFocus()
    unlistenFocus = null
  }
  if (unlistenSettingsSaved) {
    unlistenSettingsSaved()
    unlistenSettingsSaved = null
  }
  if (unlistenMoved) {
    unlistenMoved()
    unlistenMoved = null
  }
  if (moveSaveTimer) {
    clearTimeout(moveSaveTimer)
    moveSaveTimer = null
  }
  saveWindowPosition()
})
</script>

<template>
  <!--
    主窗口容器
    - data-tauri-drag-region: 使整个窗口可通过鼠标拖动移动位置
    - @dblclick.prevent: 阻止双击事件，防止 Tauri 默认的 toggleMaximize 行为
    - @click: 单击 AI 角色区域时弹出菜单
  -->
  <div
    class="relative w-screen h-screen overflow-hidden bg-transparent"
    :class="{ focused: isFocused }"
    @mousedown="onMouseDown"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Live2D 角色画布（比窗口小一圈） -->
    <Live2DCanvas
      :model-path="characterStore.current.modelPath"
      :speaking="live2dStore.isSpeaking"
    />

    <SpeechBubble />

    <AiMenu
      v-if="showMenu"
      @settings="handleMenuSettings"
      @hide="handleMenuHide"
      @bye="handleMenuBye"
    />

    <BottomInput v-if="showInput" ref="bottomInputRef" @send="handleSend" />
  </div>
</template>


