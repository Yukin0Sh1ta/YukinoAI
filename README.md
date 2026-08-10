# YukinoAI

桌面 AI 伴侣应用 — 一个始终可见的桌面宠物（Live2D 角色），支持文字对话、系统操作（Function Calling）和可配置角色人格。

基于 **Nuxt 4 + Tauri 2** 构建。

## 功能特性

- **Live2D 桌宠** — 透明置顶窗口，角色始终可见，嘴部动效与对话同步
- **流式对话** — 兼容 OpenAI 协议的 LLM 流式输出，逐字显示回复
- **Function Calling** — AI 可调用系统工具：打开应用、列目录、搜索文件、打开文件、获取系统信息
- **可配置角色** — 自定义角色名称、人格描述、系统提示词和 Live2D 模型
- **对话持久化** — 基于 SQLite 存储对话历史，支持多会话管理
- **系统托盘** — 托盘图标管理应用生命周期（显示/隐藏、设置、退出）

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | Nuxt 4 (SPA 模式) |
| 桌面运行时 | Tauri 2 |
| 状态管理 | Pinia |
| Live2D 渲染 | PixiJS + pixi-live2d-display-mulmotion (Cubism 4) |
| 样式 | Tailwind CSS 4 |
| 数据库 | SQLite (tauri-plugin-sql) |
| 设置持久化 | tauri-plugin-store |
| LLM 协议 | OpenAI 兼容 (SSE 流式 + Function Calling) |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) (Tauri 2 依赖)
- [Tauri 2 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 安装依赖
pnpm install

# 开发模式（同时启动 Nuxt dev 和 Tauri）
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

### 配置 LLM

1. 启动应用后，从系统托盘右键打开 **Settings**
2. 在 **LLM 配置** 面板中填写：
   - **Base URL** — API 端点地址（如 `https://api.openai.com/v1`）
   - **API Key** — 你的密钥
   - **Model** — 模型名称（如 `gpt-4o`）
3. 在 **桌宠配置** 面板中自定义角色人格与系统提示词
4. 点击保存

> API Key 通过 `tauri-plugin-store` 存储在系统应用数据目录中，不会离开本机。

## 项目结构

```
YukinoAI/
├── app/                    # 前端源码 (Nuxt 4)
│   ├── pages/              # 页面 (主页 / 设置)
│   ├── stores/             # Pinia 状态管理
│   ├── services/           # LLM 服务、SSE 解析、数据库访问
│   ├── composables/        # 组合式函数 (聊天编排、窗口管理、Live2D)
│   ├── tools/              # Function Calling 工具定义与执行器
│   ├── types/              # TypeScript 类型定义
│   └── plugins/            # Nuxt 插件 (Live2D 核心初始化)
├── src-tauri/              # Tauri 后端 (Rust)
│   ├── src/                # Rust 入点 (窗口、托盘、插件注册)
│   ├── capabilities/       # Tauri 权限配置
│   ├── icons/              # 应用图标
│   └── tauri.conf.json     # Tauri 配置
├── public/                 # 静态资源
│   ├── models/             # Live2D 模型文件
│   └── lib/                # Live2D Cubism Core 运行时
├── docs/                   # 项目文档
│   ├── adr/                # 架构决策记录
│   └── agents/             # Agent 工作流文档
├── CONTEXT.md              # 领域模型与通用语言
└── nuxt.config.ts          # Nuxt 配置
```

## 架构决策

项目通过 ADR (Architecture Decision Records) 记录关键设计决策，详见 [`docs/adr/`](./docs/adr/)。

## License

MIT
