# 意难平 IF

意难平 IF 是一个约束感故事分支工作台：用户先写下背景、遗憾、必须保留的结果和不能破坏的约束，再逐步核对事实、选择分支，最后生成固定六格的中文故事草稿。当前实现使用 DeepSeek `deepseek-v4-pro` 的 OpenAI-compatible Responses API，并由服务端完成结构化输出、Zod 校验和确定性规则检查。

## 当前实现

- 单页四阶段：写下遗憾、核对事实、选择分岔、读完这条路。
- 分析阶段最多展示 3 个追问；事实可确认、转为创作假设或删除。
- 分支阶段固定生成 5 个内部骨架，经两批并行审查后展示 1–3 条候选。
- 成稿阶段固定六格顺序：原始张力、分歧触发、不同选择、行动与代价、改变后的结果、情绪余韵。
- `workTitle` 只用于页面展示，不进入任何 API 请求。
- 浏览器只保存 `yinanping-if:v1` 会话快照，不保存 API key；“清除本次会话”会移除该快照。
- “载入自创示例”只载入仓库内自创输入，不代表模型结果或真实故事事实。

## 本地启动

需要 Node 24.x：

```text
npm ci
npm run dev
```

应用运行需要在服务端环境中设置四个自定义变量：

- `DEEPSEEK_API_KEY`：无默认值。
- `DEEPSEEK_BASE_URL`：无默认值，由部署环境提供 DeepSeek 兼容端点。
- `AI_CALL_TIMEOUT_MS=180000`：单次模型调用上限；路由仍受共享模型 deadline 保护。
- `MAX_REQUEST_BYTES=100000`：原始 UTF-8 请求体上限。

`api.txt` 只是操作者提供的本地秘密来源，不是运行时配置契约。应用运行时不得读取它；密钥不得进入客户端、日志、文档、提交或构建产物。部署到 Vercel 时应使用托管平台环境变量，并保留 `.gitignore` 与 `.vercelignore` 对本地秘密文件的排除。

## 接口

- `POST /api/analyze`：校验故事意图，识别事实草稿、追问和硬冲突。
- `POST /api/branches`：接收锁定事实与假设，生成并审查候选分支。
- `POST /api/storyboard`：接收选中的候选和可选最后调整，生成并复核六格成稿。

三个接口都在服务端调用固定模型 `deepseek-v4-pro`，不会把 API key 发送到浏览器；请求错误只返回安全错误码、中文提示、可选 requestId 和安全冲突详情。

## 隐私与风险

故事输入会发送给 DeepSeek 以生成结果，实际数据处理、留存和安全边界仍受提供商政策与部署平台日志策略约束；“无状态请求”不等于承诺零数据保留。公开部署目前没有账号体系，必须在发布前补充平台侧限流、滥用防护和密钥轮换策略。不要提交真实个人隐私、未公开商业材料或不应发送给第三方的内容。

## 功能边界

这是一个窄范围原型，不承诺原作官方设定、版权连续性、事实核验、长期记忆、多模型路由、自动回退或真实用户生产 SLA。模型输出仍可能失败、超时或需要重试；确定性规则只负责契约、引用和硬约束检查，不等同于文学质量证明。

## 检查命令

```text
npm run lint
npm run build
npm run eval
```

`npm run eval` 只验证不依赖模型的请求边界、结构契约、规则和调用预算，不冒充真实浏览器或真实模型验收。当前真实 branches 仅有 1 次成功和 1 次失败样本，不能据此宣称端到端稳定。

完整的真实验收证据见 [ACCEPTANCE.md](./ACCEPTANCE.md)。当前正式/临时 Vercel 部署标为 `BLOCKED_BUILD/NOT_DONE`（预构建准备阶段 symlink 权限错误）；已发布的核心路径视频只覆盖真实 analyze 与上下文确认，不代表完整端到端或稳定性验收。

## 交付链接

- GitHub 仓库 URL：[https://github.com/Nioo4/yinanping-if](https://github.com/Nioo4/yinanping-if)（public 仓库与首个提交已验证可见）
- 公共 Vercel URL：`BLOCKED_BUILD/NOT_DONE`，待在有相应权限的部署环境中重新构建并使用托管平台环境变量部署
- 核心路径演示：[Release v0.1-demo](https://github.com/Nioo4/yinanping-if/releases/tag/v0.1-demo) · [视频资产](https://github.com/Nioo4/yinanping-if/releases/download/v0.1-demo/yinanping-if-core-demo.webm)
- 不超过 5 分钟完整端到端录屏：待正式部署后补；核心路径视频不替代完整流程
