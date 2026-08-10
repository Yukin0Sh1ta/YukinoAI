# 系统操作：LLM Function Calling 模式

Yukino 的系统能力通过 LLM Function Calling 实现：大模型作为"大脑"决定调用哪些系统工具，Yukino 执行并返回结果。初始工具集包含 5 个只读/低风险操作：open_application、list_directory、search_files、open_file、get_system_info。MVP 不做删除/移动/创建文件等破坏性操作。

选择 Function Calling 而非预设命令或任意 shell，因为这是桌面 AI 助手的核心价值 — 让 LLM 自主决定何时、如何使用系统能力，而非用户手动触发。
