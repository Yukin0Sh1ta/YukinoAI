/**
 * @file useWindowPosition.ts
 * @description 主窗口屏幕位置的持久化与恢复组合式函数。
 *
 * 窗口位置存储在设置 store 中（由 tauri-plugin-store 支持的
 * settings.json 持久化）。所有 Tauri 调用均做了保护，因此在非 Tauri
 * 环境下为空操作。
 */
import { useSettingsStore } from '~/stores/settings'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * 在多次会话间持久化并恢复主窗口的屏幕位置。
 *
 * 位置存储在设置 store 中（由 tauri-plugin-store 支持的 settings.json 持久化）。
 * 所有 Tauri 调用均做了保护，因此在非 Tauri 环境下为空操作。
 */
export function useWindowPosition() {
  const settingsStore = useSettingsStore()

  /**
   * 将窗口恢复到设置中保存的位置（仅当位置非零时）。
   */
  async function restore() {
    try {
      const win = getCurrentWindow()
      const { x, y } = settingsStore.windowPosition
      if (x || y) {
        const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
        await win.setPosition(new PhysicalPosition(x, y))
      }
    } catch (e) {
      console.warn('[windowPosition] Failed to restore window position:', e)
    }
  }

  /**
   * 将当前窗口位置保存到设置并持久化到磁盘。
   */
  async function save() {
    try {
      const win = getCurrentWindow()
      const pos = await win.outerPosition()
      settingsStore.updateWindowPosition(pos.x, pos.y)
      await settingsStore.saveSettings()
    } catch (e) {
      console.warn('[windowPosition] Failed to save window position:', e)
    }
  }

  return { restore, save }
}
