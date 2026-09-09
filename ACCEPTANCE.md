# 漫画IF线验收记录

当前三层状态：项目开发已收尾并冻结（`PROJECT_CLOSED_WITH_KNOWN_LIMITATIONS`）；MVP 交付 `PASS`（`MVP_DELIVERED`）；`Release-ready=NO / strict DoD=NOT_MET`。漫画IF线新名称 production 已 Ready；永久 project domain 配置后由主 Agent 独立复核匿名公网 GET 为 PASS：HTTP 200、最终 URI 仍为 `https://comic-if-line.vercel.app/`、HTML title 为“漫画IF线”、包含产品名称且不是 Vercel 登录页。D047 production 输入门禁 PASS；D048 由 Luna Max 子 Agent 在隔离 Chromium 中执行同一条真实 production 页面序列，主 Agent 复核证据，最终从输入走通 analyze、事实确认、branches 到六格 storyboard。D049 又完成一条从初始页到六格及合规摘要的单一连续真实 production 录屏；D050 完成 branches 长尾失败的最小可靠性修复并部署，D051 在新可见隔离窗口中再次完整走通人工审核路径。MVP 证据已覆盖核心路径、公开 GitHub、production URL、本地完整录屏和修复后咒术案例；严格 DoD 仍未满足，因为 C01—C08 尚未全部完成真实页面逐项验证，也没有多样本稳定性、文学质量或原作准确性证明，未获新 Release 批准。

- 验收开始：`2026-09-09 03:57:41 +08:00`
- 初始收口记录时刻：`2026-09-09 08:48:25 +08:00`
- 初始阶段实际投入：`4 小时 50 分 44 秒`（从上述开始时间计算；达到 5 小时即停止初始阶段）
- D043/D044 续作记录时刻：`2026-09-09 12:35:21 +08:00`
- 从开始时间计算的墙钟跨度：`8 小时 37 分 40 秒`；这是用户授权后的部署续作时间线，不回写初始 5 小时投入。
- 说明：D049 的完整录屏已在本地完成并通过 HQ 离线验片；D052 将当前状态固定为“项目开发已收尾；MVP 交付 PASS；Release-ready=NO / strict DoD=NOT_MET”，不以单条成功证据声称稳定性、Release 或严格 DoD 完成。
- 续作说明：D043/D044 是用户在初始 5 小时收口后明确“已授权”的部署续作；续作不篡改上述初始投入记录。
- 续作记录时刻：`2026-09-09 12:29:54 +08:00`
- 外部验收截图：`D:\新建文件夹\恺英笔试\acceptance-artifacts`（仓库外，不提交）。

## 本地工程检查

| 检查项 | 状态 | 证据/说明 |
| --- | --- | --- |
| `npm ci` | PASS | 2026-09-09；0 vulnerabilities。ESLint 9 存在兼容性 deprecation warning，但命令成功，不判为失败。 |
| `npm run lint` | PASS | ESLint 完成，无错误。 |
| `npm run build` | PASS | Next.js 构建成功；`/` 为静态页面，三个 API Route 为动态路由。 |
| `npm run eval` | PASS | `8 cases and core rule checks`。 |

## 本次输入页最低标准与错误分流验收（D047）

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 三项 readiness、非字符数门槛和空白重复列表行的纯本地断言 | PASS | `npm run eval`；覆盖背景/遗憾/必须结果的结构性非空、缺项名称和空白列表过滤。 |
| 输入页显示指南、三项 readiness、实时已填写/待补充状态，缺项时按钮禁用且 `requestBeforeReady=0` | PASS | 本地真实 Chromium；初始空白页清楚显示指南与 readiness，缺项时未发 `/api/analyze`；证据截图：`D:\新建文件夹\恺英笔试\acceptance-artifacts\d047-input-desktop-full.png`、`D:\新建文件夹\恺英笔试\acceptance-artifacts\d047-input-mobile-full.png`（仓库外、不提交；分别 1440×2321、390×2719）。 |
| 填满三项后允许提交，额外空白 must-have/preference/constraint 被过滤 | PASS | 本地真实 Chromium；模型请求被控制拦截，拦截到的 payload 数量为 `1/0/0`（must-have/preference/constraint），未调用真实模型。 |
| `MODEL_UNAVAILABLE` 控制响应显示 service note，`INVALID_INPUT` 控制响应没有 service note | PASS | 本地真实 Chromium 控制响应；只验证前端错误分流，不冒充真实线上故障。 |
| production 输入门禁：空白 must-have 不得发起 analyze | PASS | 主 Agent 独立真实 Chromium；canonical production GET HTTP 200，HTML title 为“漫画IF线”。按用户原样输入 `workTitle=咒术回站`、`plotContext=新宿决战 五条悟打宿傩`、`regret=五条悟被腰斩。原因是五条悟的设定一直是最强 在于宿傩的对战中见招拆招处于上风但是在优势最大的那一刻宣布胜利后突然被腰斩 令人无法接受`，must-have 留空；页面显示“还需补充：至少一条 IF 线必须实现的结果。”，提交按钮 disabled，`/api/analyze` request count=0。未调用模型，未替用户补目标。 |

## D048 最终单一连续 production 浏览器全链路验收

本轮最终验收规则是：用《咒术回战》案例从输入到六格跑通即 PASS；本轮不把文学质量或原作准确性设为门槛。用户可接受五条悟死亡，击败机制没有硬性要求；最终 must-have 是“五条悟可以死亡，但从占上风/被宣布胜利到宿傩致命一击之间必须有连续、可见、符合双方能力与行动逻辑的铺垫，不能突然反转”。

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| production 页面 API 连续序列 | PASS | Luna Max 子 Agent 在隔离 Chromium 中执行的同一最终页面序列，由主 Agent 复核页面证据、最终截图与 Vercel 同序列日志：analyze HTTP 200/32.434s；录入用户已确认答案后 deliberate re-analyze HTTP 200/47.051s；branches HTTP 200/143.899s；storyboard HTTP 200/58.776s；业务重试 0。Vercel 服务端同序列日志对应 analyze 200/32.151s、re-analyze 200/46.725s、branches 200/143.385s、storyboard 200/58.460s。 |
| 事实确认与候选选择 | PASS | 初始 context 为 3 questions/7 facts/0 conflicts；最终为 3 questions/6 facts/0 conflicts，fact defaults 未修改。branches 返回 3 candidates/2 rejected；按预设验收规则选择第一条“延迟斩击由胜利宣告触发”；`finalAdjustment` 为空。 |
| 六格成稿与页面健康 | PASS | `phase04`，6 panels，编号 01—06；有合规摘要；error banner 0、page errors 0、API failures 0。仅有一个非阻断静态资源 console 404，未精确定位，不写成 favicon 等已确认原因。 |
| 证据与范围边界 | PASS | 证据截图：`D:\新建文件夹\恺英笔试\acceptance-artifacts\jujutsu-e2e-final.png`（仓库外、不提交）。本条只证明 D048 时点的一次连续 production 页面链路；不评价文学质量、不声称原作准确、不将一次成功写成稳定性证明。D048 时点完整录屏为 `NOT_DONE`，D049 后的本地录屏见下一节；整体仍 `NOT_DONE`。 |

## D049 最终完整连续 production 录屏与 HQ 视频验片

### 输入、语义映射与范围

固定输入为 `workTitle=咒术回战`、`plotContext=新宿决战 五条悟打宿傩`，遗憾及原因为：`五条悟被腰斩。原因是五条悟的设定一直是最强 在于宿傩的对战中见招拆招处于上风但是在优势最大的那一刻宣布胜利后突然被腰斩 令人无法接受`。最终派生的 must-have（明确标注为非用户原话）为：`五条悟可以在新宿决战中死亡；原作中“宣布胜利后突然被腰斩且缺少可见铺垫”是要改写的遗憾，不是必须保留的事实。IF线中，从他占据上风、被宣布胜利到宿傩完成致命一击之间，必须有连续、可见且符合双方能力与行动逻辑的铺垫，不能突然反转。`

三道实际追问均回答：`无硬性要求，重点是过渡连续、不生硬。`。这是与用户意图一致的测试输入归一，不是声称用户逐字回答；明确询问死亡许可才可使用死亡许可答案，时间跨度、死后意识、宿傩机制、展示形式等非核心问题均不能套用该答案。

### 单一连续页面与 API 证据

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 从初始页到结果页的单一连续 production 序列 | PASS（本地录屏） | run `production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z`；全新 Playwright 隔离 Chromium context，从空白/初始输入页开始，录入、提交、追问、事实确认、候选页、按预设规则选择第一条、生成六格并展示合规摘要；未碰用户浏览器，业务重试 0，不剪切、不拼接。 |
| 页面自身 API | PASS | `analyze` HTTP 200/35301ms；deliberate re-analyze HTTP 200/63828ms；`branches` HTTP 200/129577ms；`storyboard` HTTP 200/118099ms。每个业务 API 均为 200。 |
| 页面健康与结构 | PASS | 初始 8 facts/3 questions/0 conflicts；最终 5 facts/0 questions/0 conflicts；3 candidates/2 rejected；按预设验收规则选择第一条“预判解除空间斩的连续压制”，不是用户选择；`phase04`、6 panels、编号 01—06，合规摘要可见；error banner=0、page errors=0、console errors=0、API request failures=0、静态资源 HTTP errors=0。 |
| 问题与事实映射 | PASS（输入映射） | 三个实际问题均记录所选答案、匹配理由和最终请求映射于原始 manifest；本轮答案是“无硬性要求，重点是过渡连续、不生硬。”的语义一致归一，不伪称为用户逐字回答。 |

### 视频文件与离线验片

| 文件 | 状态 | 元数据与 SHA-256 |
| --- | --- | --- |
| raw WebM | PASS | `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-raw.webm`；365.92s，1440×900，VP8，18186870 bytes；SHA256 `28975CFD99734D66BEDD00C3DF8A26DB7975652AB03E7929F517E16EA4F3E574`。 |
| 最终主文件 presentation HQ MP4 | PASS | `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-presentation-hq-1.26x.mp4`；由同一 raw 全局 `1.26179310344828x` 加速，无剪切/拼接；290.04s，1440×900，H.264 High，145186640 bytes；SHA256 `58D8380494A18F93A909E731EA4CB692A22F14F3CCA9C6DED200E52A62BE6590`；完整 decode exit 0。 |
| HQ VP8 WebM 备份 | PASS | `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-presentation-hq-1.26x.webm`；290.04s，1440×900，VP8/libvpx，15671454 bytes；SHA256 `CCE9547DB64AA66C4A498CA0FB850A963EB286DB912D08B9EB7C1E42330335DF`；完整解码/重编码检查 exit 0。 |
| 原低码率 accelerated MP4 | REJECTED | `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-accelerated-1.26x.mp4` 保留但不作最终证据；虽可解码，离线抽帧发现中文文字严重重影/模糊，故不能用它代表清晰交付。 |
| manifest | PASS | `D:\新建文件夹\恺英笔试\acceptance-artifacts\production-jujutsu-e2e-playwright-2026-09-09T11-24-12-617Z-manifest.json`；116500 bytes；SHA256 `B45A26FEC869DC3DAA46569C1A5AD446BE59222B3D5D9F3C2616F1666F69D12F`；原 manifest 未改写。视频、manifest、六张 HQ 实际视频帧均在仓库外本地目录，未提交、未发布。 |

### 历史失败、拒绝与当前边界

本轮及前置录制尝试没有被拼接为成功：Chromium 初始自动化失败；旧 ffmpeg `gdigrab/draw_mouse` 不支持；脚本错误地要求 0 questions 时必须出现 `#questions-title`；`/api/branches` 曾在约 216055ms 返回 502；deliberate re-analyze 曾返回 `MODEL_OUTPUT_INVALID`/502（request `req_c9d5e9ac-bb13-4881-8f22-be74d0c105b9`）；宽泛死亡正则曾把时间跨度等非核心问题误答为死亡许可；遗憾中的“突然腰斩/缺少铺垫”曾被误当作必须保留的原作事实并造成冲突；低码率 MP4 通过解码却因画面糊被拒绝。最终在明确派生 must-have 后才形成上述成功序列，并完成 HQ 重编码和视频帧复核。

本条把“<=5 分钟完整端到端录屏”标为本地 `PASS`，不把它扩大为稳定性 PASS。多次模型/结构输出失败仍作为历史边界保留；Spec 中“遗憾描述的负面属性是 change target、不能默认成为 canon fact”的语义规则已由 D050 做 prompt 级实现，并在 D051 单样本中生效，但确定性与泛化仍待多样本验收。旧不合格 Release 已删除；D049 视频只在仓库外本地保存，不创建 Release、不上传。D049 时点记录的 `NOT_DONE` 不覆盖 D052 当前三层状态：项目开发已收尾；MVP 交付 `PASS`；`Release-ready=NO / strict DoD=NOT_MET`。

## D050 可靠性修复、部署与根因边界

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 旧 branches 失败事实 | FAIL（历史保留） | `/api/branches` request `req_bcb11188-a3e8-45a8-866e-b4ed02b8bfdb` 约 285712ms 返回 HTTP 500；Vercel 交叉证据确认 generator 已完成，失败发生在后续并行 critic 阶段贴近 285s route deadline。后来旧部署同输入有 branches 200/116026ms，因此不把它归因为输入必错。 |
| 根因结论边界 | PARTIAL | deadline-adjacent connection/timeout 异常此前被归一为 `INTERNAL_ERROR` 是基于错误形态的推断；Vercel 日志没有给出足够 cause，不能写成已确证的具体网络错误。 |
| 最小修复 commit | PASS | `fbbcb26d5f702c8d9a68d62487927ec375bf8bbb`；保留 285s route、5 skeleton、双 critic、Schema、公共 API 和质量链；首轮 `Promise.allSettled`，成功 critic 复用，失败且可重试批次各重试一次；75s retry reserve、首轮最小 30s，最多 6 次模型调用；扩展 timeout-like/due-deadline 映射与安全日志；analyze prompt 加入遗憾属性 change-target 语义规则。 |
| 本地代码检查 | PASS | `npm run eval` 8/8、`npm run lint`、`npm run build`、`git diff --check` 均 PASS；提交仅含四个批准代码/测试文件。 |
| production 部署 | PASS | Vercel deployment `HpWyeHMk7eSKFjv9NTn9uEni3Ntq` 对应 commit `fbbcb26d5f702c8d9a68d62487927ec375bf8bbb`，GitHub/Vercel 状态为成功；未创建 Release。 |

## D051 新可见隔离窗口人工审核

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 新窗口与隔离边界 | PASS | run `manual-review-jujutsu-final-2026-09-09T17-10-14-172Z`；Chromium PID `92972`、driver PID `89256`；先确认新窗口可控后关闭旧临时 PID `91316/87988`；未复用用户浏览器，最终窗口保持打开供人工审核。 |
| 页面 API 连续序列 | PASS | initial analyze 200/58265ms（5 facts/2 questions/0 conflicts）；re-analyze 200/57966ms（6 facts/0 questions/0 conflicts）；branches 页面 200/285285ms；storyboard 200/122250ms。页面没有刷新或业务级重试。 |
| branches 服务端 retry 证据 | PASS | Vercel 服务端 282821ms，requestId `req_7acbb146-ee4d-4b9e-9cf3-f6482b9daf57`；日志显示 `critic_retry` batch=1、errorCode=`INTERNAL_ERROR`、remainingMs=74993 后最终 HTTP 200。成功批次复用，失败批次单独重试。 |
| 候选与六格结果 | PASS | 3 candidates/2 rejected；按测试规则选择第一条“术式残片预热延迟环”（不是用户偏好）；`finalAdjustment` 为空；`phase04`、六格 01—06、合规摘要可见。 |
| 页面健康 | PASS（局部） | error banner=0、page errors=0、API request failures=0；另有 1 条未定位来源的静态资源 console 404，不能猜成 favicon。 |
| 问题映射边界 | PASS（有瑕疵） | 两道问题均填“无硬性要求，重点是过渡连续、不生硬。”；q1“最终结局是否必须死亡，还是可以存活或另有结果？”更精确应答“用户可以接受五条悟死亡，但生死不是硬性要求”。该自动化措辞瑕疵未施加硬结局，must-have 已明确允许死亡，记录为非阻断人工审核问题，不夸为产品确定性语义保证。 |

D050/D051 共同结论：修复后一次完整人工审核样本 PASS，但 critic retry 只余约 2.2 秒服务端余量，且没有独立第二条成功样本、文学质量/原作准确性评审或用户最终审核。D052 收口为三层状态：项目开发已收尾并冻结；MVP 交付 `PASS`；`Release-ready=NO / strict DoD=NOT_MET`。当前窗口保持打开，不创建 Release、不上传视频。

## D052 项目收口与交接

- 本轮本地检查：Node `v24.15.0`、npm `11.12.1`、`package-lock.json` 存在；`npm run lint`、`npm run build`、`npm run eval`（8/8）和 `git diff --check` 均 PASS。Next build 曾机械改写 `next-env.d.ts`，已恢复，未形成产品代码差异。
- 收口取舍：根据“尽快收尾项目”，不再追加模型调用、不为统计稳定性继续改代码；保留历史 FAIL/BLOCKED/NOT_RUN 和严格 DoD 门槛，不把 MVP PASS 扩大为 Release-ready。
- 交接风险：DeepSeek 长尾且一次 critic retry 仅余约 2.2 秒；原作准确性依赖用户确认的局部事实；语义规则只有单样本验证，不能证明泛化；存在 1 条未定位静态资源 404；无新 Release、无公开视频。旧不合格 Release 继续保持删除状态。
- 交付状态：项目开发已收尾并冻结（`PROJECT_CLOSED_WITH_KNOWN_LIMITATIONS`）；MVP 交付 `PASS`（`MVP_DELIVERED`）；`Release-ready=NO / strict DoD=NOT_MET`。若未来重新申请 Release，必须重新完成 C01—C08 真实页面逐项验证并取得明确批准。

## 真实浏览器与 API 证据

| 验收项 | 状态 | 证据/说明 |
| --- | --- | --- |
| 桌面端输入页与上下文确认页 | PASS | 真实 `/api/analyze` HTTP 200，38.860s；9 facts、3 questions、0 conflicts、`canContinue=true`；前端仅传 `intent+clarificationAnswers`，`workTitle` 未发送；console errors 0。 |
| 移动端 390×844 | PASS | 无横向溢出；4 个进度项；console errors 0。 |
| 历史真实 `/api/branches` 单次成功样本（D043/D044） | PASS | HTTP 200，118.875s；`generatedCount=5`、`candidates=3`、`rejected=2`、ID 总数 5；全部必达结果和约束覆盖；usage：input 4136 / output 13641 / total 17777。该行保留为 D048 前历史样本，不替代 D048 页面证据。 |
| branches 冲突前置拒绝 | PASS | HTTP 409，约 62ms；模型 usage 为空。 |
| 100000 bytes 限制 | PASS | 150225-byte 请求 HTTP 413，约 95ms；模型 usage 为空。 |
| 真实 `/api/storyboard` | PASS | HTTP 200，92.176s；有标题、6 panels、panelNo 1..6；角色依次为 `original_tension` / `divergence_trigger` / `different_choice` / `action_and_cost` / `changed_result` / `emotional_aftertaste`；must-have、preference、constraint 均覆盖；assumptionCount=0；server usage：input 3182 / output 6001 / total 9183。 |
| session restore | PASS | `workTitle`、`regret`、动态列表刷新恢复；坏 JSON 安全回到空白输入页；fatal error false；console errors 0。 |
| 历史第二次真实端到端录屏（D043/D044） | FAIL | `/api/analyze` PASS：24.254s，usage input 879 / output 2211 / total 3090；随后 `/api/branches` 在 179.971s 返回 HTTP 502，usage input 1344 / output 3073 / total 4417，前端未进入候选页；录屏已终止，不作为成功演示。 |
| 历史 branches 稳定性样本汇总（D043/D044） | FAIL | 当时有 1 次成功、1 次失败（成功率样本 1/2），不足以宣称端到端稳定；失败路径按安全错误语义返回 502 属产品安全失败行为 PASS。该历史统计不吸收或替代 D048 单次成功。 |
| 核心路径演示视频（历史证据，已失效） | INVALIDATED | 原 `v0.1-demo` Release/asset 曾记录 48.60s、3,532,816 bytes；范围仅为载入自创示例 → 真实 analyze → 上下文确认，真实 analyze 49.155s、factCards=6、questionCards=3、consoleError=0，不覆盖 branches/storyboard。2026-09-09 经用户审核不合格已删除 Release 及 asset，历史数据保留但不再作为有效交付证据；D049 是另一本地完整录屏，未创建替代 Release。 |
| production deployment | PASS | 本次统一命名前的 Vercel 历史部署，当前地址见下方新名称交付记录；build 31s、Node 24.x、function timeout 300s。 |
| production 环境配置 | PASS | 已配置四个变量名：`DEEPSEEK_BASE_URL`、`DEEPSEEK_API_KEY`（sensitive）、`AI_CALL_TIMEOUT_MS`、`MAX_REQUEST_BYTES`（config）；不记录值。 |
| production GET（agent） | PASS | 改名前历史 production alias HTTP 200，标题包含“让遗憾拥有另一条可信的路”；当前地址见下方新名称交付记录。 |
| production GET（改名后） | PASS | 永久 project domain 配置后由主 Agent 独立复核：HTTP 200，最终 URI 仍为 `https://comic-if-line.vercel.app/`，HTML title 为“漫画IF线”，包含产品名称且不是 Vercel 登录页。该行只覆盖页面 GET；D048 已另行完成一次连续页面链路，但不代表稳定性。 |
| production GET（改名前独立复核） | PASS | 改名前历史 production alias 独立 HTTP 200，537ms，标题匹配；该证据不代表改名后页面通过。 |
| 历史 production `/api/analyze`（D043/D044） | PASS | 客户端 HTTP 200、59.639s；7 facts、3 questions、0 conflicts、`canContinue=true`；Vercel 服务端日志 58.736s/status 200，usage input 878 / output 3921 / total 4799。保留为 D048 前历史请求。 |
| 历史 production `/api/branches`（D043/D044） | PARTIAL | 客户端在 142.697s 发生本地传输中断、无 HTTP 响应；Vercel 服务端日志显示 153.732s/status 200，usage input 4384 / output 12069 / total 16453。未验证公网响应体结构，不能写完整端到端 PASS；D048 已有新的页面 200 序列，该行仍保留为历史部分证据。 |
| 历史 production `/api/storyboard`（D043/D044） | NOT_RUN | 当时本机后续 vercel.app DNS/连接不稳定，未做公网 storyboard；D048 已完成新的页面 storyboard 200 序列，该行仍保留为历史未运行记录。 |
| production protection bypass 清理 | PASS | 在单一 PowerShell 进程内读取现有 bypass 属性名，仅用于执行 disable；命令 exit 0，复查 `bypassCount=0`。未输出、记录或提交 secret。 |

## 交付状态

| 交付项 | 状态 | 地址/说明 |
| --- | --- | --- |
| GitHub 公共仓库 | PASS | [https://github.com/Nioo4/comic-if-line](https://github.com/Nioo4/comic-if-line)；已确认 `isPrivate=false`。平台保留的旧 URL redirect 属 GitHub 历史机制，不作为当前地址。 |
| GitHub 本次重命名提交 push | PASS | 重命名提交与部署引用提交均已推送；核验时本地分支与 `origin/main` 对齐；未使用 force push。 |
| Vercel 临时公开部署 | BLOCKED | D041 在临时 Linux 容器中 `npm ci` 和 Next build PASS，上传进度完成（约 1.8MB）；匿名远端 builder 因计划限制失败，历史临时路径不作为 production 证据。 |
| Vercel 临时匿名部署 | BLOCKED | `BLOCKED_PLAN`：匿名计划只接受 1–60 秒，而三条 Route 固定为 `maxDuration=300`；不为假上线降低产品时限设计。 |
| 正式 Vercel 公网部署 | PASS | Vercel project `nioo4s-projects/comic-if-line`，project id `prj_3jFl5xENw4ijm17w3qcNLDqYKv97`；当前 production deployment 状态为 `READY`，永久、已验证 project domain/canonical alias 为 [https://comic-if-line.vercel.app](https://comic-if-line.vercel.app)。旧主域、旧团队域、旧 git-main 域均不在当前 alias list；历史 immutable deployment 不删除、不作为当前地址。D048 页面链路与 D049 本地录屏均为单次样本，不证明稳定性或 Release 就绪。 |
| 核心路径演示视频（历史 Release） | INVALIDATED | 原 `v0.1-demo` Release 及视频 asset 经用户审核不合格已删除，不再作为有效交付证据；D049 未创建替代 Release 或上传视频。 |
| 不超过 5 分钟完整端到端录屏 | PASS（本地） | D049 主 HQ MP4 290.04s，1440×900，完整 decode exit 0，HQ 实际视频帧抽检清晰；文件只保存在仓库外本地 `acceptance-artifacts`，不代表公开 Release。 |
| 项目开发收尾 | PASS | 工程实现、文档、production 部署和本地证据已收口并冻结；状态为 `PROJECT_CLOSED_WITH_KNOWN_LIMITATIONS`。 |
| MVP 交付 | PASS | `MVP_DELIVERED`：核心路径、公开 GitHub、production URL、本地完整录屏和 D051 修复后咒术案例均有 PASS 证据。 |
| Release-ready / strict DoD | NO / NOT_MET | C01—C08 尚未全部完成真实页面逐项验证；无多样本稳定性、文学质量或原作准确性证明，未获新 Release 批准。 |

用户授权后的 D043 动作已完成：link → 服务端敏感环境变量 → production deploy；D046 完成 GitHub/Vercel 原地改名和新 production deploy，D048 以同一条真实 Chromium production 序列完成输入 → analyze → 事实确认 → branches → storyboard 六格，D049 又完成同案例的完整本地录屏与 HQ 离线验片。D048/D049 都只是单次样本，不证明文学质量、原作准确性或稳定性；D052 已将项目冻结为 MVP 交付 PASS、Release-ready=NO、strict DoD=NOT_MET。D049 视频未创建 Release、未上传，正式授权链接不会写入文档。

## 安全与证据边界

- D039 中 `api.txt` 由主 Agent 在单一 PowerShell 进程内读取并只映射到部署子进程环境变量；值未输出、写文件或写日志，它不属于仓库。
- 本记录只记录已实际核验的证据，不把模型自述、mock、直接 API 探针或本地构建结果当作浏览器全链路证据；D043/D044 的 1/2 branches 统计保留为历史，D048 及 D049 也都只是一次连续页面成功，不宣称端到端稳定；历史核心路径视频明确不覆盖 branches/storyboard，D049 完整录屏虽已本地 PASS 仍不等同于 Release。
- 仓库内常见 secret pattern scan：PASS（未发现命中）；仓库内禁止路径 scan：PASS（无 `api.txt`、本地 env、AGENTS/CLAUDE、截图或媒体文件；`.vercel` 仅本地生成且未跟踪）；`.gitignore` 与 `.vercelignore` 已排除 `api.txt`、`.env*`、构建缓存和 `acceptance-artifacts`。
- `api.txt` 精确值比较：PASS（由主 Agent 在内存中完成，不输出秘密；2 条非空值均未命中，`exactSecretMatchCount=0`、`genericSecretPatternMatchCount=0`）；本仓库未提交或输出任何 key。
- 网络边界：此前本机 curl、Node 和受控浏览器的 `vercel.app` 连接不稳定属于历史验收上下文；D048 只采用最后一条页面自身监听的连续序列并由 Vercel 日志交叉核对，不据此宣称全球 SLA。
- D044 保护设置边界：仅处理 automation bypass；最终 `bypassCount=0`，未改动其他保护设置，也未记录临时或原有 secret。
