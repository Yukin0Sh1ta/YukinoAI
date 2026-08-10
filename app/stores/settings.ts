/**
 * @file 设置 Store
 * @description 管理用户可配置设置（LLM 提供商、角色、窗口位置等），
 *              并负责通过 tauri-plugin-store 持久化到 settings.json。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { load } from '@tauri-apps/plugin-store'
import type { ProviderConfig, WindowPosition, Settings, Character } from '~/types'

/** 设置文件名 */
const SETTINGS_FILE = 'settings.json'

/** 设置 Store，管理应用全部用户配置项及其持久化 */
export const useSettingsStore = defineStore('settings', () => {
  // --- 状态 ---
  const provider = ref<ProviderConfig>({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
  })
  const characterId = ref<string>('yukino')
  const modelPath = ref<string>('/models/default/default.model3.json')
  const windowPosition = ref<WindowPosition>({ x: 0, y: 0 })
  const windowVisible = ref<boolean>(true)
  // 角色配置（名称、人格、系统提示词等）
  const character = ref<Character | null>(null)

  // --- Getters ---

  /** 是否已完成必要配置（依据是否设置了 apiKey） */
  const isConfigured = computed(() => Boolean(provider.value.apiKey))

  // --- Actions ---

  /**
   * 从 tauri-plugin-store（settings.json）加载设置。
   * 当键缺失或存储不可用时回退到默认值。
   */
  async function loadSettings() {
    try {
      const store = await load(SETTINGS_FILE, { autoSave: false, defaults: {} })

      const savedProvider = await store.get<Partial<ProviderConfig>>('provider')
      if (savedProvider) {
        provider.value = { ...provider.value, ...savedProvider }
      }

      const savedCharacterId = await store.get<string>('characterId')
      if (savedCharacterId) {
        characterId.value = savedCharacterId
      }

      const savedModelPath = await store.get<string>('modelPath')
      if (savedModelPath) {
        modelPath.value = savedModelPath
      }

      const savedWindowPosition = await store.get<WindowPosition>('windowPosition')
      if (savedWindowPosition) {
        windowPosition.value = savedWindowPosition
      }

      const savedWindowVisible = await store.get<boolean>('windowVisible')
      if (typeof savedWindowVisible === 'boolean') {
        windowVisible.value = savedWindowVisible
      }

      // 加载角色配置
      const savedCharacter = await store.get<Character>('character')
      if (savedCharacter) {
        character.value = savedCharacter
      }
    } catch (e) {
      console.warn('[settings] Failed to load settings from store:', e)
    }
  }

  /**
   * 将当前设置持久化到 tauri-plugin-store（settings.json）。
   */
  async function saveSettings() {
    try {
      const store = await load(SETTINGS_FILE, { autoSave: false, defaults: {} })
      await store.set('provider', { ...provider.value })
      await store.set('characterId', characterId.value)
      await store.set('modelPath', modelPath.value)
      await store.set('windowPosition', { ...windowPosition.value })
      await store.set('windowVisible', windowVisible.value)
      if (character.value) {
        await store.set('character', { ...character.value })
      }
      await store.save()
    } catch (e) {
      console.error('[settings] Failed to save settings to store:', e)
    }
  }

  /**
   * 将部分提供商配置合并到当前 provider 状态中。
   */
  function updateProvider(partial: Partial<ProviderConfig>) {
    provider.value = { ...provider.value, ...partial }
  }

  /**
   * 更新已记忆的窗口位置。
   */
  function updateWindowPosition(x: number, y: number) {
    windowPosition.value = { x, y }
  }

  /**
   * 切换窗口可见性标志。
   */
  function toggleWindowVisible() {
    windowVisible.value = !windowVisible.value
  }

  /**
   * 导出完整设置快照（便于调试 / 迁移）。
   */
  function getSnapshot(): Settings {
    return {
      provider: { ...provider.value },
      characterId: characterId.value,
      modelPath: modelPath.value,
      windowPosition: { ...windowPosition.value },
      windowVisible: windowVisible.value,
    }
  }

  return {
    // state
    provider,
    characterId,
    modelPath,
    windowPosition,
    windowVisible,
    character,
    // getters
    isConfigured,
    // actions
    loadSettings,
    saveSettings,
    updateProvider,
    updateWindowPosition,
    toggleWindowVisible,
    getSnapshot,
  }
})
