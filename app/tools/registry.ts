import type { Tool } from '~/types'
import { invoke } from '@tauri-apps/api/core'

// 工具定义（发送给 LLM 使用）
export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'open_application',
    description:
      'Open a system application by name. On Windows, opens the application. Common apps: notepad, calc, explorer, mspaint, cmd.',
    parameters: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'Application name or command to execute, e.g. "notepad", "calc", "explorer"',
        },
      },
      required: ['app'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a given path.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute directory path to list',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for files by name pattern in a directory and its subdirectories.',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory to search in',
        },
        pattern: {
          type: 'string',
          description: 'File name pattern to search for (supports wildcards like *.txt)',
        },
      },
      required: ['directory', 'pattern'],
    },
  },
  {
    name: 'open_file',
    description: 'Open a file with its default system application.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute file path to open',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_system_info',
    description:
      'Get basic system information including OS, architecture, and hostname.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

// 工具执行器映射表：根据工具名调用对应实现
export const TOOL_EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  /**
   * 打开系统应用程序。
   * 交由 Rust 侧的白名单命令执行，不经过 shell。
   * @param args 包含 app 字段（应用名称）
   * @returns JSON 字符串，包含执行结果
   */
  async open_application(args) {
    // 去除首尾空格和可能的多余引号（LLM 传入的参数可能带引号）
    const app = String(args.app ?? '').trim().replace(/^["']|["']$/g, '')
    if (!app) return JSON.stringify({ success: false, error: 'Missing required parameter: app' })
    try {
      await invoke('open_application', { app })
      return JSON.stringify({ success: true, app })
    } catch (e) {
      return JSON.stringify({ success: false, app, error: String(e) })
    }
  },

  /**
   * 列出指定目录下的文件与子目录。
   * @param args 包含 path 字段（绝对路径）
   * @returns JSON 字符串，包含目录条目列表
   */
  async list_directory(args) {
    const path = String(args.path ?? '').trim()
    if (!path) return JSON.stringify({ success: false, error: 'Missing required parameter: path' })
    try {
      const entries = await invoke<string[]>('list_directory', { path })
      return JSON.stringify({ success: true, path, entries })
    } catch (e) {
      return JSON.stringify({ success: false, path, error: String(e) })
    }
  },

  /**
   * 在指定目录及其子目录中按文件名模式搜索文件。
   * @param args 包含 directory（搜索目录）与 pattern（文件名模式）
   * @returns JSON 字符串，包含匹配的文件列表（最多 50 条）
   */
  async search_files(args) {
    const directory = String(args.directory ?? '').trim()
    const pattern = String(args.pattern ?? '').trim()
    if (!directory) return JSON.stringify({ success: false, error: 'Missing required parameter: directory' })
    if (!pattern) return JSON.stringify({ success: false, error: 'Missing required parameter: pattern' })
    try {
      const matches = await invoke<string[]>('search_files', { directory, pattern })
      return JSON.stringify({ success: true, directory, pattern, count: matches.length, matches })
    } catch (e) {
      return JSON.stringify({ success: false, directory, pattern, error: String(e) })
    }
  },

  /**
   * 使用系统默认应用程序打开指定文件。
   * @param args 包含 path 字段（绝对文件路径）
   * @returns JSON 字符串，包含执行结果
   */
  async open_file(args) {
    // 去除首尾多余引号
    const path = String(args.path ?? '').trim().replace(/^["']|["']$/g, '')
    if (!path) return JSON.stringify({ success: false, error: 'Missing required parameter: path' })
    try {
      await invoke('open_path', { path })
      return JSON.stringify({ success: true, path })
    } catch (e) {
      return JSON.stringify({ success: false, path, error: String(e) })
    }
  },

  /**
   * 获取系统基本信息，包括操作系统名称、CPU 架构和主机名。
   * 由 Rust 侧直接读取环境变量，不调用外部命令。
   * @param _args 未使用的参数
   * @returns JSON 字符串，包含系统信息
   */
  async get_system_info(_args) {
    try {
      const info = await invoke<{ os: string; arch: string; hostname: string }>('system_info')
      return JSON.stringify({ success: true, ...info })
    } catch (e) {
      return JSON.stringify({ success: false, error: String(e) })
    }
  },
}
