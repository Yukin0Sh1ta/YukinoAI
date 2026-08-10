# 大模型接入：纯云端 API + Tauri HTTP plugin

大模型调用走纯云端 API（用户配置自己的 API key），不在本地跑模型。LLM API 请求通过 `@tauri-apps/plugin-http` 的 JS API 发起，API key 从 secure storage 读取，webview 不接触 key。流式响应（SSE）通过 plugin-http 的 stream 能力逐块传回前端。

最初设计用 Nuxt server route（`server/api/`）做 proxy，但 `nuxt.config.ts` 中 Nitro preset 为 `static`，Tauri 打包后无 Node server 运行，`server/api/` 路由在生产环境不存在。改用 Tauri HTTP plugin 后，proxy 意图（安全 + 无 CORS）得以保留，且不需要写 Rust 代码。

选择纯云端 API 而非本地模型，因为 MVP 聚焦角色体验和对话质量，本地推理环境（Ollama / llama.cpp）的复杂度会拖慢交付。本地模型支持可后续追加。
