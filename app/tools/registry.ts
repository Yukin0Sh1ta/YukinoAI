import type { Tool } from '~/types'
import { Command } from '@tauri-apps/plugin-shell'

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
      'Get basic system information including OS, hostname, and available memory.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

/**
 * 通过 cmd /c 执行 Windows 命令，返回标准输出、标准错误和退出码。
 * @param args 传递给 cmd /c 的参数数组
 * @returns 包含 stdout、stderr 和 code 的结果对象
 */
async function runCmd(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cmd = Command.create('cmd', ['/c', ...args])
  const output = await cmd.execute()
  return {
    stdout: (output.stdout ?? '').trim(),
    stderr: (output.stderr ?? '').trim(),
    code: output.code ?? -1,
  }
}

// 工具执行器映射表：根据工具名调用对应实现
export const TOOL_EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  /**
   * 打开系统应用程序。
   * @param args 包含 app 字段（应用名称或命令）
   * @returns JSON 字符串，包含执行结果
   */
  async open_application(args) {
    // 去除首尾空格和可能的多余引号（LLM 传入的参数可能带引号）
    const app = String(args.app ?? '').trim().replace(/^["']|["']$/g, '')
    if (!app) return JSON.stringify({ success: false, error: 'Missing required parameter: app' })
    try {
      // 判断是否是 URL，用 start 直接打开（不加空标题引号，避免引号残留）
      const result = await runCmd(['start', app])
      if (result.code !== 0 && result.stderr) {
        return JSON.stringify({ success: false, error: result.stderr })
      }
      return JSON.stringify({ success: true, app })
    } catch (e) {
      return JSON.stringify({ success: false, error: String(e) })
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
      const result = await runCmd(['dir', '/b', path])
      if (result.code !== 0) {
        return JSON.stringify({ success: false, path, error: result.stderr || `Cannot list directory: ${path}` })
      }
      const entries = result.stdout.split(/\r?\n/).filter(Boolean)
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
      const searchPath = `${directory}\\${pattern}`
      const result = await runCmd(['dir', '/s', '/b', searchPath])
      if (result.code !== 0 && !result.stdout) {
        return JSON.stringify({ success: false, directory, pattern, error: result.stderr || 'No files found' })
      }
      const matches = result.stdout.split(/\r?\n/).filter(Boolean).slice(0, 50)
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
      const result = await runCmd(['start', path])
      if (result.code !== 0 && result.stderr) {
        return JSON.stringify({ success: false, path, error: result.stderr })
      }
      return JSON.stringify({ success: true, path })
    } catch (e) {
      return JSON.stringify({ success: false, path, error: String(e) })
    }
  },

  /**
   * 获取系统基本信息，包括操作系统名称、主机名和内存信息。
   * 优先尝试完整 systeminfo 命令，失败时回退到轻量命令。
   * @param _args 未使用的参数
   * @returns JSON 字符串，包含系统信息
   */
  async get_system_info(_args) {
    try {
      // 优先尝试完整的 systeminfo 命令；失败时回退到轻量命令
      let osName = 'unknown'
      let hostname = 'unknown'
      let totalMemory = 'unknown'
      let availableMemory = 'unknown'

      const sysResult = await runCmd(['systeminfo'])
      if (sysResult.code === 0 && sysResult.stdout) {
        const lines = sysResult.stdout.split(/\r?\n/)
        for (const line of lines) {
          const lower = line.toLowerCase()
          const idx = line.indexOf(':')
          if (idx === -1) continue
          const key = lower.slice(0, idx).trim()
          const val = line.slice(idx + 1).trim()
          if (key.includes('os name')) osName = val
          else if (key.includes('host name')) hostname = val
          else if (key.includes('total physical memory')) totalMemory = val
          else if (key.includes('available physical memory')) availableMemory = val
        }
      } else {
        // 回退方案
        const verResult = await runCmd(['ver'])
        if (verResult.code === 0 && verResult.stdout) osName = verResult.stdout

        const hostResult = await runCmd(['hostname'])
        if (hostResult.code === 0 && hostResult.stdout) hostname = hostResult.stdout
      }

      return JSON.stringify({
        success: true,
        os: osName,
        hostname,
        totalMemory,
        availableMemory,
      })
    } catch (e) {
      return JSON.stringify({ success: false, error: String(e) })
    }
  },
}
