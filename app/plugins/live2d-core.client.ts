/**
 * live2d-core.client.ts - Live2D Cubism Core 运行时加载插件
 *
 * 在客户端加载 Live2D Cubism Core 运行时脚本。
 *
 * Cubism Core 以压缩浏览器脚本形式分发（非 npm 包），
 * 因此将其注入到 <head> 中，并在 `window` 上可用时 resolve。
 *
 * 仅在客户端运行（.client.ts）。
 */
export default defineNuxtPlugin(async () => {
  if (typeof window === 'undefined') return
  if ((window as any).Live2DCubismCore) return // 已加载则跳过

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    // 使用本地副本以保证可靠性——根据上游文档，CDN 链接不稳定
    script.src = '/lib/live2dcubismcore.min.js'
    script.async = true
    script.onload = () => {
      if ((window as any).Live2DCubismCore) {
        resolve()
      } else {
        reject(new Error('Cubism Core script loaded but window.Live2DCubismCore not found'))
      }
    }
    script.onerror = () =>
      reject(new Error('Failed to load Live2D Cubism Core from /lib/live2dcubismcore.min.js'))
    document.head.appendChild(script)
  })
})
