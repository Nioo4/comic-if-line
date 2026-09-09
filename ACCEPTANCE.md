# 意难平 IF 验收记录

当前整体状态：尚未 Done。Vercel 公网部署因 CLI 认证阻塞，完整端到端公开录屏仍未完成；核心路径演示已单独发布，不能替代完整流程或稳定性证据。

- 验收开始：`2026-09-09 03:57:41 +08:00`
- 本轮记录时刻：`2026-09-09 08:21:33 +08:00`
- 截至本轮记录实际投入：`4 小时 23 分 52 秒`（从上述开始时间计算）
- 说明：最终交付结束时间和总投入待线上部署后更新；达到 5 小时必须停止并如实提交状态。
- 外部验收截图：`D:\新建文件夹\恺英笔试\acceptance-artifacts`（仓库外，不提交）。

## 本地工程检查

| 检查项 | 状态 | 证据/说明 |
| --- | --- | --- |
| `npm ci` | PASS | 2026-09-09；0 vulnerabilities。ESLint 9 存在兼容性 deprecation warning，但命令成功，不判为失败。 |
| `npm run lint` | PASS | ESLint 完成，无错误。 |
| `npm run build` | PASS | Next.js 构建成功；`/` 为静态页面，三个 API Route 为动态路由。 |
| `npm run eval` | PASS | `8 cases and core rule checks`。 |

## 真实浏览器与 API 证据

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 桌面端输入页与上下文确认页 | PASS | 真实 `/api/analyze` HTTP 200，38.860s；9 facts、3 questions、0 conflicts、`canContinue=true`；前端仅传 `intent+clarificationAnswers`，`workTitle` 未发送；console errors 0。 |
| 移动端 390×844 | PASS | 无横向溢出；4 个进度项；console errors 0。 |
| 真实 `/api/branches` 单次成功样本 | PASS | HTTP 200，118.875s；`generatedCount=5`、`candidates=3`、`rejected=2`、ID 总数 5；全部必达结果和约束覆盖；usage：input 4136 / output 13641 / total 17777。仅代表一次成功样本。 |
| branches 冲突前置拒绝 | PASS | HTTP 409，约 62ms；模型 usage 为空。 |
| 100000 bytes 限制 | PASS | 150225-byte 请求 HTTP 413，约 95ms；模型 usage 为空。 |
| 真实 `/api/storyboard` | PASS | HTTP 200，92.176s；有标题、6 panels、panelNo 1..6；角色依次为 `original_tension` / `divergence_trigger` / `different_choice` / `action_and_cost` / `changed_result` / `emotional_aftertaste`；must-have、preference、constraint 均覆盖；assumptionCount=0；server usage：input 3182 / output 6001 / total 9183。 |
| session restore | PASS | `workTitle`、`regret`、动态列表刷新恢复；坏 JSON 安全回到空白输入页；fatal error false；console errors 0。 |
| 第二次真实端到端录屏 | FAIL | `/api/analyze` PASS：24.254s，usage input 879 / output 2211 / total 3090；随后 `/api/branches` 在 179.971s 返回 HTTP 502，usage input 1344 / output 3073 / total 4417，前端未进入候选页；录屏已终止，不作为成功演示。 |
| branches 稳定性样本汇总 | FAIL | 当前有 1 次成功、1 次失败（成功率样本 1/2），不足以宣称端到端稳定；失败路径按安全错误语义返回 502 属产品安全失败行为 PASS。 |
| 核心路径演示视频 | PASS | [GitHub Release v0.1-demo](https://github.com/Nioo4/yinanping-if/releases/tag/v0.1-demo) / [视频资产](https://github.com/Nioo4/yinanping-if/releases/download/v0.1-demo/yinanping-if-core-demo.webm)；48.60s、3,532,816 bytes；范围仅为载入自创示例 → 真实 analyze → 上下文确认，真实 analyze 49.155s、factCards=6、questionCards=3、consoleError=0，不覆盖 branches/storyboard。 |

## 交付状态

| 交付项 | 状态 | 地址/说明 |
| --- | --- | --- |
| GitHub 公共仓库 | PASS | `https://github.com/Nioo4/yinanping-if`；2026-09-09 08:07:22 +08:00 创建并确认 `isPrivate=false`。 |
| GitHub 初始提交 push | PASS | `HEAD:main` 已推送；远端 `main` 指向提交 `bb693f0d6bdd64fb013726805bc1904002964997`，并由 `gh repo view` 验证 URL 可见、`isPrivate=false`。未使用 force push。 |
| Vercel 临时公开部署 | BLOCKED | 官方 CLI `vercel deploy --temporary --yes` exit code 1，错误类别为 auth；未产生 deployment/claim URL，未把它写成上线。 |
| 正式 Vercel 公网部署 | BLOCKED | `BLOCKED_AUTH/NOT_DONE`：当前未登录 Vercel，待后续授权后使用托管平台环境变量部署。 |
| 核心路径演示视频 | PASS | 已发布至 [Release v0.1-demo](https://github.com/Nioo4/yinanping-if/releases/tag/v0.1-demo)，只上传该核心路径视频；失败的完整端到端录屏未上传。 |
| 不超过 5 分钟完整端到端录屏 | NOT_RUN | 核心路径视频不等同于完整端到端演示；待正式部署并重新录制。 |

## 安全与证据边界

- D039 中 `api.txt` 由主 Agent 在单一 PowerShell 进程内读取并只映射到部署子进程环境变量；值未输出、写文件或写日志，它不属于仓库。
- 本记录只记录已实际核验的证据，不把模型自述、mock、直接 API 探针或本地构建结果当作浏览器全链路证据；branches 当前仅有 1/2 成功样本，不宣称端到端稳定；核心路径视频明确不覆盖 branches/storyboard。
- 仓库内常见 secret pattern scan：PASS（未发现命中）；仓库内禁止路径 scan：PASS（无 `api.txt`、本地 env、AGENTS/CLAUDE、截图或媒体文件；`.vercel` 仅本地生成且未跟踪）；`.gitignore` 与 `.vercelignore` 已排除 `api.txt`、`.env*`、构建缓存和 `acceptance-artifacts`。
- `api.txt` 精确值比较：PASS（由主 Agent 在内存中完成，不输出秘密；2 条非空值均未命中，`exactSecretMatchCount=0`、`genericSecretPatternMatchCount=0`）；本仓库未提交或输出任何 key。
