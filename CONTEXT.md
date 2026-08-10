# YukinoAI

桌面 AI 伴侣应用 — 一个始终可见的桌面宠物（Live2D 角色），支持文字对话、系统操作（Function Calling）和可配置角色人格。基于 Nuxt 4 + Tauri 2 构建。

## Language

**Character**:
一个可加载的角色配置包，包含名字、人格描述、系统提示词和 Live2D 模型路径。YukinoAI 默认加载一个 Character，用户可切换。
_Avoid_: Persona, profile, avatar

**Conversation**:
用户与 Character 之间的一次对话会话，包含按时间排序的消息序列。一个 Character 可以有多个 Conversation。
_Avoid_: Chat, session, dialogue, thread

**Message**:
Conversation 中的单条消息，有 role（user / assistant / system / tool）和 content。assistant 消息可能附带 tool_calls。
_Avoid_: Entry, record, turn, utterance

**Tool**:
Yukino 可以调用的系统能力单元，通过 LLM Function Calling 触发。每个 Tool 有名称、描述、参数 schema 和执行器。
_Avoid_: Function, capability, action, plugin

**ToolCall**:
LLM 决定调用某个 Tool 的请求，包含 Tool 名称和参数。Yukino 执行后将结果作为 tool 消息返回给 LLM。
_Avoid_: Action request, command, invocation

**Provider**:
大模型 API 的提供方（如 OpenAI、Anthropic、DeepSeek）。用户在设置中配置 Provider 的 API key 和模型选择。
_Avoid_: Backend, service, engine, model source

**Live2D Model**:
.moc3 格式的 Live2D Cubism 模型文件，定义角色的外观和动画。YukinoAI 内置一个默认模型，用户可更换。
_Avoid_: Avatar, sprite, rig, character model (ambiguous with Character)

**System Tool**:
Yukino 通过 Function Calling 调用的预定义系统操作能力（打开应用、列目录、搜索文件、打开文件、获取系统信息）。
_Avoid_: Native command, OS function

**Settings Window**:
独立的标准窗口，用于配置 API key、Provider、Character、Live2D 模型等。与主窗口（透明置顶）分离。
_Avoid_: Config panel, preferences dialog

**Main Window**:
透明置顶窗口，承载 Live2D 角色和对话侧边面板。始终可见，点击角色弹出对话。
_Avoid_: Pet window, overlay

**Tray**:
系统托盘图标，提供应用生命周期管理入口（退出、打开设置、切换角色可见/隐藏）。透明窗口无标题栏，Tray 是用户管理应用的唯一持久入口。
_Avoid_: System tray icon, notification icon

**Provider Config**:
用户在设置中配置的 Provider 连接信息，包含 base_url、api_key 和 model name。遵循 OpenAI 兼容协议格式。
_Avoid_: Connection, account, API config

**Stream**:
LLM 回复的流式传输模式，Yukino 的回复逐字出现在对话气泡中，Live2D 嘴部同步动效联动。使用 OpenAI 兼容 API 的 `stream: true`。
_Avoid_: Streaming, chunked response, token stream

**ToolCall Card**:
对话流中 ToolCall 的可视化展示，折叠状态显示"正在调用 Tool..."，展开后显示 Tool 名称、参数和执行结果。内嵌在对话消息流中，不打断气泡的连续性。
_Avoid_: Tool result widget, function card, action panel
