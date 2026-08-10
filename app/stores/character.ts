/**
 * @file 角色 Store
 * @description 管理当前角色与可用角色列表，支持按 id 加载角色或直接设置角色，
 *              并与设置 Store 中持久化的角色配置联动。
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Character } from '~/types'
import { DEFAULT_CHARACTER } from '~/types'
import { useSettingsStore } from './settings'

/** 角色 Store，管理当前角色与可用角色列表 */
export const useCharacterStore = defineStore('character', () => {
  // --- 状态 ---
  const current = ref<Character>({ ...DEFAULT_CHARACTER })
  const available = ref<Character[]>([{ ...DEFAULT_CHARACTER }])

  // --- Actions ---

  /**
   * 按 id 从可用列表中加载角色。
   * 若已保存于设置中则使用该配置，否则使用默认值。
   */
  function loadCharacter(id: string) {
    // 优先使用 settingsStore 中持久化的角色配置
    const savedCharacter = useSettingsStore().character
    if (savedCharacter && savedCharacter.id === id) {
      current.value = { ...savedCharacter }
      return
    }

    const found = available.value.find((c) => c.id === id)
    if (found) {
      current.value = { ...found }
    } else {
      console.warn(`[character] Character "${id}" not found, using default`)
    }
  }

  /**
   * 直接设置当前角色。
   * 同时确保该角色存在于可用列表中。
   */
  function setCharacter(char: Character) {
    current.value = { ...char }
    const exists = available.value.some((c) => c.id === char.id)
    if (!exists) {
      available.value.push({ ...char })
    }
  }

  return {
    // state
    current,
    available,
    // actions
    loadCharacter,
    setCharacter,
  }
})
