# 漫画IF线

漫画IF线是一个约束感故事分支工作台：用户先写下背景、遗憾、必须保留的结果和不能破坏的约束，再逐步核对事实、选择分支，最后生成固定六格的中文故事草稿。当前实现使用 DeepSeek `deepseek-v4-pro` 的 OpenAI-compatible Responses API，并由服务端完成结构化输出、Zod 校验和确定性规则检查。

## 当前实现

- 单页四阶段：写下遗憾、核对事实、选择分岔、读完这条路。
- 分析阶段最多展示 3 个追问；事实可确认、转为创作假设或删除。
- 分支阶段固定生成 5 个内部骨架，经两批并行审查后展示 1–3 条候选。
- 分支首轮两个 critic 在同一 285 秒请求 deadline 下并行；成功批次复用，失败且可重试的批次最多各补一次调用，首轮预留 75 秒 retry 余量/至少 30 秒尝试时间，整个请求最多 6 次模型调用；这只是有限瞬态失败缓解，不是稳定性或文学质量保证。
- 成稿阶段固定六格顺序：原始张力、分歧触发、不同选择、行动与代价、改变后的结果、情绪余韵。
- `workTitle` 只用于页面展示，不进入任何 API 请求。
- 浏览器只保存 `comic-if-line:v1` 会话快照，不保存 API key；“清除本次会话”会移除该快照。
- “载入自创示例”只载入仓库内自创输入，不代表模型结果或真实故事事实。
- 输入页会说明开始分析的三项最低标准：背景、遗憾及原因、至少一条具体的“IF 线必须实现的结果”。没有字符数硬门槛，页面按结构性非空实时显示缺项；偏好、约束和余韵可留空，空白附加行会被忽略。
- 最低检查通过只代表可以开始分析，信息缺口会在 analyze 后由 1—3 个问题继续补齐；请求发出后的模型/网络/内部错误会明确标注为服务失败，不等同于输入不完整。
- IF 线的必达目标不一定要改变原作最终结果：用户可以接受原结果，只要求重写导致结果的连续因果过程；目标仍须具体、可检查。

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

`npm run eval` 只验证不依赖模型的请求边界、结构契约、规则和调用预算，不冒充真实浏览器或真实模型验收。D048 补充了一次真实 production Chromium 从输入到六格的页面样本；D049 又完成了一条从初始页到六格的完整单一连续录屏；D050/D051 记录了 branches 长尾修复、prompt 级语义规则实现、部署和新可见窗口人工审核，后者在单样本中生效，但不代表端到端稳定、文学质量、原作准确性或语义规则的确定性与泛化。

完整的真实验收证据见 [ACCEPTANCE.md](./ACCEPTANCE.md)。匿名临时 Vercel 部署仍为 `BLOCKED_PLAN`（匿名计划限制 1–60 秒，应用 Route 固定 `maxDuration=300`）；正式 production 已 Ready，D049 已用隔离 Playwright Chromium 以一条连续序列跑通 analyze、事实确认、branches 和 storyboard 六格，并将 raw/HQ 录屏保存在仓库外本地。录屏这一项可标为本地 `PASS`，但稳定性、文学质量、原作准确性和 Release 就绪仍未完成；当前整体仍为 `NOT_DONE`。原核心路径视频曾被发布，但经用户审核不合格后已删除，不再作为有效交付证据，也未用新录屏创建 Release 或上传。

## 交付链接

- GitHub 仓库 URL：[https://github.com/Nioo4/comic-if-line](https://github.com/Nioo4/comic-if-line)（public；本次原地重命名后已验证可见）
- 匿名临时 Vercel：`BLOCKED_PLAN`，不以降低 `maxDuration` 换取假上线
- 正式公共 Vercel URL：[https://comic-if-line.vercel.app](https://comic-if-line.vercel.app)（production `READY`；project `nioo4s-projects/comic-if-line`；新 immutable deployment 不作为当前用户地址）
- 改名后公网页面复核：`PASS`；永久 project domain 配置后由主 Agent 独立复核匿名 GET 为 HTTP 200，最终 URI 仍为 `https://comic-if-line.vercel.app/`，HTML title 为“漫画IF线”，包含产品名称且不是 Vercel 登录页。该证据只覆盖页面 GET；D048 另有完整页面链路证据。
- D048 production 单一连续真实 Chromium 页面链路（Luna Max 子 Agent 在隔离 Chromium 中执行，主 Agent 复核页面证据、最终截图与 Vercel 同序列日志）：analyze 200/32.434s，录入用户已确认答案后 deliberate re-analyze 200/47.051s，branches 200/143.899s，storyboard 200/58.776s，业务重试 0；初始 3 questions/7 facts/0 conflicts，最终 3 questions/6 facts/0 conflicts；3 candidates/2 rejected，按预设验收规则选择“延迟斩击由胜利宣告触发”，最终六格 `phase04`、01—06、合规摘要。页面 error banner/page errors/API failures 均为 0；另有一个未精确定位的非阻断静态资源 console 404。该单样本不代表稳定性或文学质量/原作准确性。
- D049 最终完整录屏（本地 `PASS`，不代表 Release）：run `production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z`；`analyze` 200/35301ms、deliberate re-analyze 200/63828ms、`branches` 200/129577ms、`storyboard` 200/118099ms；初始 8 facts/3 questions/0 conflicts，最终 5 facts/0 questions/0 conflicts；3 candidates/2 rejected，按预设验收规则选择第一条“预判解除空间斩的连续压制”（不是用户选择），六格 `phase04`、01—06、合规摘要可见；error banner/page errors/API request failures 均为 0。原始 WebM 365.92s；同一原片整体 `1.26179310344828x` 加速后，主文件 `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-presentation-hq-1.26x.mp4` 为 290.04s、1440×900、H.264 High、145186640 bytes、SHA256 `58D8380494A18F93A909E731EA4CB692A22F14F3CCA9C6DED200E52A62BE6590`；无剪切、无拼接、无业务重试，隔离浏览器未碰用户浏览器。
- D049 备份与 manifest：raw WebM `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-raw.webm`，18186870 bytes、SHA256 `28975CFD99734D66BEDD00C3DF8A26DB7975652AB03E7929F517E16EA4F3E574`；HQ VP8 WebM `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-presentation-hq-1.26x.webm`，290.04s/15671454 bytes、SHA256 `CCE9547DB64AA66C4A498CA0FB850A963EB286DB912D08B9EB7C1E42330335DF`；manifest `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-manifest.json`，116500 bytes、SHA256 `B45A26FEC869DC3DAA46569C1A5AD446BE59222B3D5D9F3C2616F1666F69D12F`。三个媒体文件与 manifest 均在仓库外，未提交、未发布；低码率 `accelerated-1.26x.mp4` 保留但因中文文字重影/模糊明确 `REJECTED`，不能作最终证据。
- Production protection bypass：D044 已撤销，当前查询为 `bypassCount=0`；未记录或公开任何 secret。
- 核心路径演示视频（历史 Release）：原 Release/tag `v0.1-demo` 及视频 asset 经用户审核不合格后删除，历史视频不再作为有效交付证据；D049 完整录屏未创建替代 Release/未上传
- 不超过 5 分钟完整端到端录屏：D049 本地 `PASS`（主 HQ MP4 290.04s，完整解码与抽帧复核通过），但未创建 Release、未上传视频；D050 已完成语义规则的 prompt 级实现并由 D051 单样本验证，确定性与泛化仍待多样本验收；整体仍 `NOT_DONE`

## D050/D051 可靠性修复与人工审核边界

- D050 修复 commit：`fbbcb26d5f702c8d9a68d62487927ec375bf8bbb`，仅保留 285 秒 route、5 骨架、双 critic、Schema 和公共 API；首轮 critic 用 `Promise.allSettled`，成功批次复用，失败且可重试批次各重试一次，最多 6 次模型调用。扩展 timeout-like error 与 deadline exhausted 映射，并在 analyze prompt 中区分原作事件与要改写的评价性遗憾属性、去重事实、限制“无硬性要求”晋升 canon 和重复追问。`npm run eval` 8/8、lint、build、diff-check 均 PASS；Vercel deployment `HpWyeHMk7eSKFjv9NTn9uEni3Ntq` 对应 commit 成功。
- 旧 `/api/branches` 失败 `req_bcb11188-a3e8-45a8-866e-b4ed02b8bfdb` 约 285712ms/500 的确证边界是 generator 完成、critic 阶段贴近 route deadline；deadline-adjacent connection/timeout 被归一为 `INTERNAL_ERROR` 只是推断。后来同输入旧部署 branches 200/116026ms，不能把旧失败写成输入必错。
- D051 新可见隔离窗口 run `manual-review-jujutsu-final-2026-09-09T17-10-14-172Z`（Chromium PID `92972`、driver `89256`，窗口保持打开）完整通过：analyze 200/58265ms、re-analyze 200/57966ms、branches 200/285285ms、storyboard 200/122250ms；branches 服务端 282821ms，requestId `req_7acbb146-ee4d-4b9e-9cf3-f6482b9daf57`，`critic_retry` batch=1/`INTERNAL_ERROR`/remainingMs=74993 后返回 200。3 candidates/2 rejected，第一条测试选择“术式残片预热延迟环”，六格 01–06 和合规摘要可见，error banner/page errors/API failures 均为 0。
- 两道追问均填“无硬性要求，重点是过渡连续、不生硬。”；q1“最终结局是否必须死亡，还是可以存活或另有结果？”更精确应答“用户可以接受五条悟死亡，但生死不是硬性要求”，已记录为自动化措辞瑕疵而非产品失败。另有 1 条未定位来源的静态资源 console 404，不猜成 favicon。整体仍 `NOT_DONE`/release-not-ready；无 Release、无视频上传，等待用户人工审核窗口。
