/**
 * @file useLive2D.ts
 * @description Live2D 模型渲染与嘴部动画组合式函数。
 *
 * 基于 PIXI.js 与 pixi-live2d-display-mulmotion，负责在指定 canvas 上
 * 创建 PIXI Application、加载 Live2D 模型、驱动说话时的嘴部动画，
 * 并提供模型销毁、就绪状态与错误信息的统一管理。
 */
import { ref, type Ref } from 'vue'
import { useLive2DStore } from '~/stores/live2d'

/**
 * useLive2D 组合式函数的返回值接口。
 */
export interface UseLive2DReturn {
  /** 加载指定路径的 Live2D 模型到画布 */
  loadModel: (modelPath: string) => Promise<void>
  /** 开始说话状态（驱动嘴部动画） */
  startSpeaking: () => void
  /** 停止说话状态（嘴部回到闭合） */
  stopSpeaking: () => void
  /** 销毁模型与 PIXI 应用，移除监听器 */
  destroy: () => void
  /** 模型是否就绪 */
  isReady: Ref<boolean>
  /** 错误信息（无错误时为 null） */
  error: Ref<string | null>
}

// 懒加载的模块引用（避免在 SSR/预渲染时执行 pixi-live2d-display）
type PixiModule = typeof import('pixi.js')
type L2DModule = typeof import('@sekai-world/pixi-live2d-display-mulmotion')

let pixiModule: PixiModule | null = null
let l2dModule: L2DModule | null = null

/** PIXI 与 Live2DModel 的打包集合。 */
interface PixiBundle {
  PIXI: PixiModule
  Live2DModel: L2DModule['Live2DModel']
}

/**
 * 确保 PIXI 与 Live2D 模块已加载并完成 ticker 注册。
 * 模块采用懒加载方式，避免 SSR/预渲染阶段求值。
 */
async function ensurePixi(): Promise<PixiBundle> {
  if (!pixiModule || !l2dModule) {
    const [pixi, l2d] = await Promise.all([
      import('pixi.js'),
      import('@sekai-world/pixi-live2d-display-mulmotion'),
    ])
    pixiModule = pixi as PixiModule
    l2dModule = l2d as L2DModule
    // 只注册一次 ticker
    l2dModule.Live2DModel.registerTicker(pixiModule.Ticker as any)
  }
  return { PIXI: pixiModule, Live2DModel: l2dModule!.Live2DModel }
}

/**
 * Live2D 组合式函数。
 *
 * @param canvasRef 指向 canvas 元素的 ref
 * @returns 模型加载、说话控制、销毁等方法及状态
 */
export function useLive2D(
  canvasRef: Ref<HTMLCanvasElement | null>,
): UseLive2DReturn {
  const live2dStore = useLive2DStore()
  const isReady = ref<boolean>(false)
  const error = ref<string | null>(null)

  let app: import('pixi.js').Application | null = null
  let model: import('@sekai-world/pixi-live2d-display-mulmotion').Live2DModel | null = null
  let tickerAdded = false

  // 嘴部动画状态
  let mouthTimer = 0
  let mouthTarget = 0
  let currentMouth = 0

  const MOUTH_TICK_INTERVAL = 6 // 60fps 下约 100ms
  const MOUTH_SMOOTHING = 0.3

  /**
   * 驱动嘴部动画的 ticker 回调。
   * 说话时每约 100ms 选取一个伪随机的嘴部目标值；
   * 否则目标为 0（闭合）。以平滑插值方式逼近目标值。
   */
  const tickerCallback = (delta: number): void => {
    if (!model) return
    mouthTimer += delta
    if (mouthTimer > MOUTH_TICK_INTERVAL) {
      mouthTarget = live2dStore.isSpeaking ? Math.random() * 0.8 + 0.2 : 0
      mouthTimer = 0
    }
    // 平滑插值逼近目标值
    currentMouth += (mouthTarget - currentMouth) * MOUTH_SMOOTHING

    // 同步 store 中的嘴部开合值（内部会做 clamp）
    live2dStore.setMouthOpen(currentMouth)

    // `coreModel` 在库中被声明为 `object` 类型；此处强转为 `any`
    // 以调用底层 Cubism Core 的 `setParameterValueById`。
    const coreModel = (model as any).internalModel?.coreModel
    if (!coreModel) return
    try {
      coreModel.setParameterValueById('PARAM_MOUTH_OPEN_Y', currentMouth)
    } catch {
      // 当前模型未找到该参数，跳过
    }
  }

  /**
   * 创建 PIXI Application 并挂载嘴部动画 ticker。
   * Application 的画布大小取自 canvas 元素的 clientWidth/clientHeight，
   * 默认值 400×600（与 tauri.conf.json 中窗口初始大小一致）。
   */
  async function ensureApp(): Promise<import('pixi.js').Application | null> {
    if (typeof window === 'undefined') return null
    if (!canvasRef.value) return null
    if (app) return app

    try {
      const { PIXI } = await ensurePixi()

      // 创建 PIXI 应用，画布大小 = canvas 元素的 CSS 像素尺寸
      // 窗口固定（tauri.conf.json: resizable: false），所以画布大小也固定
      app = new PIXI.Application({
        view: canvasRef.value,
        backgroundAlpha: 0,   // 透明背景，使窗口透明效果生效
        antialias: true,
        autoStart: true,
        width:  canvasRef.value.clientWidth , // 画布宽度，跟随窗口
        height: canvasRef.value.clientHeight   // 画布高度，跟随窗口
      })

      if (!tickerAdded) {
        app.ticker.add(tickerCallback)
        tickerAdded = true
      }

      // 监听窗口尺寸变化——虽然窗口 resizable:false 不会变化，
      // 但保留此逻辑以备未来需要
      const onResize = (): void => {
        if (!app || !canvasRef.value) return
        const width = canvasRef.value.clientWidth || 400
        const height = canvasRef.value.clientHeight || 600
        app.renderer.resize(width, height)
        centerModel()
      }
      window.addEventListener('resize', onResize)
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      console.error('[useLive2D] Failed to create PIXI Application:', err)
      error.value = `PIXI init failed: ${msg}`
      app = null
    }

    return app
  }

  /**
   * 将模型居中并缩放以适配画布。
   * AI 角色大小由此处的 scale 决定：
   *   scale = min(画布宽 / 模型原始宽, 画布高 / 模型原始高)
   * 由于窗口固定 400×600 且 resizable:false，scale 值也是固定的，
   * 不会因双击或拖拽而改变。
   */
  function centerModel(): void {
    if (!app || !model) return
    const width = app.renderer.width
    const height = app.renderer.height

    // 等比缩放以适配画布并保持宽高比
    const scale = Math.min(
      width / (model as any).width,
      height / (model as any).height,
    )
    ;(model as any).scale.set(scale)

    // 水平居中，锚点接近底部
    ;(model as any).anchor.set(0.5, 0.5)
    ;(model as any).x = width / 2
    ;(model as any).y = height / 2
  }

  /**
   * 从 `.model3.json` 路径加载 Live2D 模型到画布。
   */
  async function loadModel(modelPath: string): Promise<void> {
    if (typeof window === 'undefined') return
    if (!modelPath) return

    const pixiApp = await ensureApp()
    if (!pixiApp) return

    // 从舞台移除已有模型
    if (model) {
      try {
        pixiApp.stage.removeChild(model as any)
        ;(model as any).destroy()
      } catch (err) {
        console.warn('[useLive2D] Error destroying previous model:', err)
      }
      model = null
    }

    live2dStore.setLoaded(false)
    isReady.value = false
    live2dStore.setModelPath(modelPath)

    try {
      const { Live2DModel } = await ensurePixi()
      model = await Live2DModel.from(modelPath) as any
      pixiApp.stage.addChild(model as any)
      centerModel()

      live2dStore.setLoaded(true)
      isReady.value = true
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      console.error('[useLive2D] Failed to load Live2D model:', err)
      error.value = `Model load failed: ${msg}`
      live2dStore.setLoaded(false)
      isReady.value = false
    }
  }

  /**
   * 开始说话状态——通过 ticker 驱动嘴部动画。
   */
  function startSpeaking(): void {
    live2dStore.setSpeaking(true)
  }

  /**
   * 停止说话状态——嘴部回到 0。
   */
  function stopSpeaking(): void {
    live2dStore.setSpeaking(false)
    mouthTarget = 0
    live2dStore.setMouthOpen(0)
  }

  /**
   * 清理：销毁模型与 PIXI 应用，移除监听器。
   */
  function destroy(): void {
    if (app) {
      if (tickerAdded) {
        app.ticker.remove(tickerCallback)
        tickerAdded = false
      }
    }
    if (model) {
      try {
        app?.stage.removeChild(model as any)
        ;(model as any).destroy()
      } catch (err) {
        console.warn('[useLive2D] Error destroying previous model:', err)
      }
      model = null
    }
    if (app) {
      try {
        app.destroy(true, { children: true } as any)
      } catch (err) {
        console.warn('[useLive2D] Error destroying PIXI app:', err)
      }
      app = null
    }
    live2dStore.setLoaded(false)
    isReady.value = false
    mouthTimer = 0
    mouthTarget = 0
    currentMouth = 0
  }

  return {
    loadModel,
    startSpeaking,
    stopSpeaking,
    destroy,
    isReady,
    error,
  }
}
