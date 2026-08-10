/**
 * @file useWindowManager.ts
 * @description Tauri 窗口管理组合式函数。
 *
 * 负责：打开/聚焦设置窗口、切换主窗口可见性、退出应用，
 * 以及读写主窗口的位置和尺寸。所有 Tauri API 调用均包裹在
 * try-catch 中，确保在非 Tauri 环境（如浏览器开发）下也能优雅降级。
 */
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { ref } from 'vue'

/**
 * 管理 Tauri 窗口：打开/聚焦设置窗口、切换主窗口、退出应用，
 * 以及读写主窗口的位置和尺寸。
 *
 * 所有 Tauri API 调用均包裹在 try-catch 中，确保组合式函数在非 Tauri
 * 环境（如浏览器开发）下也能优雅降级。
 */
export function useWindowManager() {
  /** 主窗口是否处于聚焦状态 */
  const isFocused = ref(true)

  let focusUnlisten: (() => void) | null = null

  /**
   * 开始追踪窗口聚焦/失焦事件。
   * 返回一个用于取消监听的函数。
   */
  async function trackFocus(): Promise<() => void> {
    try {
      const win = getCurrentWindow()
      focusUnlisten = await listen<boolean>('tauri://focus-changed', (e) => {
        isFocused.value = e.payload
      })
      // 同时使用窗口自身的事件
      win.onFocusChanged(({ payload: focused }) => {
        isFocused.value = focused
      })
    } catch (e) {
      console.warn('[windowManager] trackFocus failed:', e)
    }
    return () => {
      if (focusUnlisten) {
        focusUnlisten()
        focusUnlisten = null
      }
    }
  }

  /**
   * 打开（或聚焦）设置窗口。
   */
  async function openSettings() {
    try {
      const existing = await WebviewWindow.getByLabel('settings')
      if (existing) {
        await existing.show()
        await existing.setFocus()
        return
      }
      const win = new WebviewWindow('settings', {
        url: '/settings',
        title: 'Settings',
        width: 500,
        height: 600,
        resizable: true,
        center: true,
      })
      win.once('tauri://error', (e: unknown) => {
        console.error('[windowManager] Failed to create settings window:', e)
      })
    } catch (e) {
      console.error('[windowManager] openSettings failed:', e)
    }
  }

  /**
   * 隐藏（最小化）主窗口。
   */
  async function hideWindow() {
    try {
      const win = getCurrentWindow()
      await win.hide()
    } catch (e) {
      console.warn('[windowManager] hideWindow failed:', e)
    }
  }

  /**
   * 通过关闭当前窗口退出应用。
   */
  async function quitApp() {
    try {
      const win = getCurrentWindow()
      await win.close()
    } catch (e) {
      console.warn('[windowManager] quitApp failed:', e)
    }
  }

  /**
   * 切换主窗口的可见性。
   */
  async function toggleMainWindow() {
    try {
      const win = getCurrentWindow()
      if (await win.isVisible()) {
        await win.hide()
      } else {
        await win.show()
        await win.setFocus()
      }
    } catch (e) {
      console.warn('[windowManager] toggleMainWindow failed:', e)
    }
  }

  /**
   * 将当前窗口移动到物理坐标 (x, y) 位置。
   */
  async function setWindowPosition(x: number, y: number) {
    try {
      const win = getCurrentWindow()
      const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
      await win.setPosition(new PhysicalPosition(x, y))
    } catch (e) {
      console.warn('[windowManager] setWindowPosition failed:', e)
    }
  }

  /**
   * 读取当前窗口的外部位置。
   */
  async function getWindowPosition(): Promise<{ x: number; y: number }> {
    try {
      const win = getCurrentWindow()
      const pos = await win.outerPosition()
      return { x: pos.x, y: pos.y }
    } catch (e) {
      console.warn('[windowManager] getWindowPosition failed:', e)
      return { x: 0, y: 0 }
    }
  }

  /**
   * 获取当前窗口的物理尺寸。
   */
  async function getWindowSize(): Promise<{ width: number; height: number }> {
    try {
      const win = getCurrentWindow()
      const size = await win.outerSize()
      return { width: size.width, height: size.height }
    } catch (e) {
      console.warn('[windowManager] getWindowSize failed:', e)
      return { width: 400, height: 600 }
    }
  }

  /**
   * 设置窗口尺寸（物理像素）。
   */
  async function setWindowSize(width: number, height: number) {
    try {
      const win = getCurrentWindow()
      const { LogicalSize } = await import('@tauri-apps/api/dpi')
      await win.setSize(new LogicalSize(width, height))
    } catch (e) {
      console.warn('[windowManager] setWindowSize failed:', e)
    }
  }

  /**
   * 开始拖拽窗口（用于自定义标题栏拖拽）。
   */
  async function startDragging() {
    try {
      const win = getCurrentWindow()
      await win.startDragging()
    } catch (e) {
      console.warn('[windowManager] startDragging failed:', e)
    }
  }

  /**
   * 注册 'open-settings' Tauri 事件的监听器。
   */
  function onOpenSettings(callback: () => void): Promise<() => void> {
    return listen('open-settings', () => callback())
  }

  return {
    isFocused,
    trackFocus,
    openSettings,
    hideWindow,
    quitApp,
    toggleMainWindow,
    setWindowPosition,
    getWindowPosition,
    getWindowSize,
    setWindowSize,
    startDragging,
    onOpenSettings,
  }
}
