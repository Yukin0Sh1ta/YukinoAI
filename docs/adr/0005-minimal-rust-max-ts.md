# 后端架构：最小 Rust + 最大 TS

YukinoAI 的后端逻辑绝大部分用 TypeScript 实现。Rust 侧只使用 Tauri 官方插件（plugin-store、plugin-sql、plugin-shell 等），不写自定义 Rust command。LLM API 调用、对话管理、角色逻辑、Function Calling 调度全在 TS 侧。

选择最小 Rust 是因为开发者不熟悉 Rust 语言，且 Tauri 2 的官方插件生态已覆盖所需 native 能力（存储、SQLite、shell），无需自定义 Rust 代码。这显著降低开发和维护门槛。
