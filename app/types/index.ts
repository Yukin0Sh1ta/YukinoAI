/**
 * @file 类型定义文件
 * @description 定义应用中所有核心数据模型，包括角色、消息、对话、工具、
 *              提供商配置、Live2D 模型、窗口位置与用户设置等。
 */

// 角色 - 可加载的角色配置包
export interface Character {
  id: string
  name: string
  personality: string          // 人格描述
  systemPrompt: string         // LLM 的系统提示词
  modelPath: string            // .model3.json 文件路径
  avatar?: string              // 可选的聊天头像
}

// 消息 - 对话中的单条消息
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]       // 触发工具调用的助手消息上存在
  toolCallId?: string          // 工具结果消息上存在
  toolName?: string            // 工具结果消息上存在
  createdAt: number            // Unix 时间戳（毫秒）
  isStreaming?: boolean        // 助手消息正在流式输出时为 true
}

// 对话 - 用户与角色之间的聊天会话
export interface Conversation {
  id: string
  characterId: string
  title: string
  createdAt: number
  updatedAt: number
}

// 工具 - 可通过 LLM 函数调用机制调用的系统能力单元
export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>  // JSON Schema
}

// 工具调用 - LLM 请求调用某个工具
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string  // JSON 字符串，可能分块到达
  }
}

// 工具调用结果 - 执行某次工具调用的结果
export interface ToolCallResult {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  result: string
  success: boolean
  error?: string
}

// 提供商配置 - 用户的 LLM 提供商连接信息
export interface ProviderConfig {
  baseUrl: string       // 例如 "https://api.openai.com/v1"
  apiKey: string        // 存储于安全存储
  model: string         // 例如 "gpt-4o"
}

// Live2D 模型信息
export interface Live2DModelInfo {
  name: string
  modelPath: string     // .model3.json 文件路径
}

// 窗口位置（用于角色拖拽记忆）
export interface WindowPosition {
  x: number
  y: number
}

// 设置 - 所有用户可配置的设置项
export interface Settings {
  provider: ProviderConfig
  characterId: string
  modelPath: string
  windowPosition: WindowPosition
  windowVisible: boolean
}

/** 默认角色配置 */
export const DEFAULT_CHARACTER: Character = {
  id: 'Yukino',
  name: '雪乃',
  personality: '冷静、温柔的 AI 伙伴。说话简洁，语气平和。',
  systemPrompt: `你是"雪乃"（Yukino），一个冷静、温柔的桌面 AI 伙伴。
你的性格特点：
- 说话简洁，语气平和，不啰嗦
- 始终关心用户`,

  modelPath: '/models/default/default.model3.json',
}
