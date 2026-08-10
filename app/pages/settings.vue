<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '~/stores/settings'
import { useCharacterStore } from '~/stores/character'
import { getCurrentWindow } from '@tauri-apps/api/window'

const settingsStore = useSettingsStore()
const characterStore = useCharacterStore()

// 当前选中的设置面板
const activeTab = ref<'llm' | 'pet'>('llm')

// LLM 配置表单
const llmForm = reactive({
  baseUrl: '',
  apiKey: '',
  model: '',
})

// 桌宠配置表单
const petForm = reactive({
  name: '',
  personality: '',
  systemPrompt: '',
  modelPath: '',
})

const saving = ref(false)
const savedMessage = ref('')

/** 从 store 加载配置到表单，供编辑使用 */
function loadFormsFromStore() {
  llmForm.baseUrl = settingsStore.provider.baseUrl
  llmForm.apiKey = settingsStore.provider.apiKey
  llmForm.model = settingsStore.provider.model

  const char = characterStore.current
  petForm.name = char.name
  petForm.personality = char.personality
  petForm.systemPrompt = char.systemPrompt
  petForm.modelPath = char.modelPath
}

/** 保存配置：将表单数据写回 store 并持久化，显示保存结果提示 */
async function save() {
  saving.value = true
  savedMessage.value = ''
  try {
    // 保存 LLM 配置
    settingsStore.updateProvider({
      baseUrl: llmForm.baseUrl.trim(),
      apiKey: llmForm.apiKey.trim(),
      model: llmForm.model.trim(),
    })

    // 保存桌宠配置
    const updatedChar = {
      ...characterStore.current,
      name: petForm.name.trim(),
      personality: petForm.personality.trim(),
      systemPrompt: petForm.systemPrompt.trim(),
      modelPath: petForm.modelPath.trim(),
    }
    characterStore.setCharacter(updatedChar)
    // 同步到 settingsStore 以便持久化
    settingsStore.character = updatedChar

    await settingsStore.saveSettings()
    savedMessage.value = '已保存'
    setTimeout(() => {
      savedMessage.value = ''
    }, 2500)
  } catch (e) {
    savedMessage.value = `保存失败: ${String(e)}`
  } finally {
    saving.value = false
  }
}

/** 关闭设置窗口：隐藏当前窗口 */
async function closeWindow() {
  try {
    const win = getCurrentWindow()
    await win.hide()
  } catch (e) {
    console.warn('[settings] Failed to close settings window:', e)
  }
}

/** 标题栏拖动：按钮区域不触发拖动 */
function onTitleBarMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return
  getCurrentWindow().startDragging()
}

/** 组件挂载：加载设置与角色信息，填充表单 */
onMounted(async () => {
  await settingsStore.loadSettings()
  characterStore.loadCharacter(settingsStore.characterId)
  loadFormsFromStore()
})
</script>

<!--
  settings.vue - 设置页面
  - 提供大模型（LLM）与桌宠（Pet）两套配置面板
  - 左侧标签页切换，右侧表单输入，底部统一保存
  - 标题栏可拖动移动窗口，关闭按钮隐藏窗口
-->
<template>
  <div class="flex flex-col w-screen h-screen bg-[#1e1e28] font-sans text-[#e8e8e8] overflow-hidden rounded-xl">
    <div
      class="flex items-center justify-between px-4 py-2 bg-[#181820] cursor-grab select-none shrink-0 active:cursor-grabbing"
      @mousedown="onTitleBarMouseDown"
    >
      <span class="text-sm font-semibold text-white/90">设置</span>
      <button
        class="w-7 h-7 border-none rounded-full bg-transparent text-white/60 cursor-pointer text-lg flex items-center justify-center transition-colors hover:bg-red-500/50 hover:text-white"
        @click="closeWindow"
      >×</button>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <nav class="w-40 bg-[#181820] p-2 flex flex-col gap-1 shrink-0">
        <button
          class="px-3.5 py-2.5 border-none rounded-lg bg-transparent text-white/60 cursor-pointer text-sm text-left transition-colors hover:bg-white/6 hover:text-white/85"
          :class="activeTab === 'llm' ? 'bg-blue-500/20 text-[#a8c8ff] font-medium' : ''"
          @click="activeTab = 'llm'"
        >
          LLM 配置
        </button>
        <button
          class="px-3.5 py-2.5 border-none rounded-lg bg-transparent text-white/60 cursor-pointer text-sm text-left transition-colors hover:bg-white/6 hover:text-white/85"
          :class="activeTab === 'pet' ? 'bg-blue-500/20 text-[#a8c8ff] font-medium' : ''"
          @click="activeTab = 'pet'"
        >
          桌宠配置
        </button>
      </nav>

      <main class="content-scroll flex-1 flex flex-col p-5 px-6 overflow-y-auto">
        <section v-if="activeTab === 'llm'" class="flex flex-col gap-3.5 flex-1">
          <h2 class="text-base font-semibold m-0 mb-1 text-white/95">大模型配置</h2>

          <div
            v-if="settingsStore.isConfigured"
            class="inline-block px-2.5 py-1 rounded-md text-xs font-semibold self-start bg-green-500/15 text-green-400"
          >
            已配置
          </div>
          <div
            v-else
            class="inline-block px-2.5 py-1 rounded-md text-xs font-semibold self-start bg-yellow-500/15 text-yellow-400"
          >
            未配置 API Key
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">Base URL</label>
            <input
              v-model="llmForm.baseUrl"
              type="text"
              placeholder="https://api.openai.com/v1"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>


          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">API Key</label>
            <input
              v-model="llmForm.apiKey"
              type="password"
              placeholder="sk-..."
              autocomplete="off"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">Model</label>
            <input
              v-model="llmForm.model"
              type="text"
              placeholder="astron-code-latest"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>
        </section>

        <section v-if="activeTab === 'pet'" class="flex flex-col gap-3.5 flex-1">
          <h2 class="text-base font-semibold m-0 mb-1 text-white/95">桌宠配置</h2>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">角色名称</label>
            <input
              v-model="petForm.name"
              type="text"
              placeholder="雪乃"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">人格描述</label>
            <textarea
              v-model="petForm.personality"
              rows="3"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">系统提示词</label>
            <textarea
              v-model="petForm.systemPrompt"
              rows="6"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-white/70">Live2D 模型路径</label>
            <input
              v-model="petForm.modelPath"
              type="text"
              placeholder="/models/default/default.model3.json"
              class="px-3 py-2 border border-white/10 rounded-lg bg-white/6 text-[#e8e8e8] text-sm outline-none transition-colors focus:border-[#6a8cab]/60 resize-y placeholder:text-white/30"
            />
            <span class="text-xs text-white/35">指向 .model3.json 入口文件</span>
          </div>
        </section>

        <div class="flex items-center justify-end gap-3 pt-4 mt-auto">
          <Transition name="fade">
            <span v-if="savedMessage" class="text-sm text-green-400">{{ savedMessage }}</span>
          </Transition>
          <button
            class="px-6 py-2 border-none rounded-lg bg-[#4285f4] text-white text-sm font-semibold cursor-pointer transition-colors hover:bg-[#3367d6] disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 自定义滚动条样式（适配深色主题） */
.content-scroll::-webkit-scrollbar {
  width: 6px;
}
.content-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.content-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
.content-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
