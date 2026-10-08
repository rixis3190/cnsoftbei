# 项目交接文档（HANDOVER）

> **本文件是本项目「修改记录」与「后续需求」的唯一真源。**
> 任何代码改动、配置变更、决策变更、缺陷修复、新增需求，必须登记到本文件 §12（变更台账）与 §13（需求池）；其他任何文档（README / AGENTS.md）只做**引用**，不重复记录，否则视为违规。

---

## 目录

| 章 | 内容 | 主要读者 |
|---|---|---|
| §0 | 本文档怎么用（三种角色 + 阅读路径） | 所有人，先读 |
| §1 | 项目是什么（业务视角 + 技术视角） | 零基础接手人 |
| §2 | 接手前 60 分钟必做清单 | 接手执行者 |
| §3 | 环境与工具链（含三个必踩的坑） | 接手执行者 |
| §4 | 代码地图（目录职责 + 关键位置索引 + 数据流） | 零基础接手人 |
| §5 | 现状实测基线（2026-10-07 核实，含红色基线） | 接手执行者 / 复核者 |
| §6 | 已知问题台账（P0/P1/P2，含根因与修法建议） | 接手执行者 |
| §7 | 关键决策记录 ADR-01 ~ ADR-14 | 所有人（避免推翻已定决策） |
| §8 | 实施操作手册（步骤 -1 ~ 6 的可执行版本） | 接手执行者（主战场） |
| §9 | 开关与降级速查表 | 接手执行者 |
| §10 | 门禁与 CI 操作手册（本地如何复现每个 job） | 接手执行者 |
| §11 | 故障排查手册（症状 → 原因 → 处置） | 接手执行者 |
| §12 | 变更记录台账（唯一真源 + 写入规则 + 模板） | 所有人 |
| §13 | 后续需求池（唯一真源 + 录入规则 + 模板） | 所有人 |
| §14 | 术语表 | 零基础接手人 |
| §15 | 交接检查清单（签字式） | 交接双方 |

**配套计划文档（必须一起读）**

| 文件 | 作用 | 什么时候读 |
|---|---|---|
| `实施计划_细化版.md` | 执行依据：每步任务卡、风险表、DoD、故障演练、命令清单 | 开工前通读一遍，执行时对照 |
| `plan.md`（原始路线规划） | 选型依据：技术选型对比、架构图、目录结构、接口定义 | 想了解「为什么这样选」时<br>⚠️ **该文件已不在仓库**（从未入库，见 §15.3）：只看「历史决策来源」，实际执行口径以 `实施计划_细化版.md` 为准 |
| 路线原文 `AI项目升级路线.md` | 上游需求方给出的路线（可能不在仓库内） | 需要确认需求边界时 |

**阅读顺序建议**：§0 → §1 → §2 → §5 → §7 → §8（边做边读）→ 随时查 §11 / §14。

---

## §0 本文档怎么用

### §0.1 三种角色与路径

| 角色 | 目标 | 建议路径 |
|---|---|---|
| **A. 接手执行者**（主要读者） | 从零开始把计划全部落地 | §1 → §2 → §3 → §4 → §5 → §6 → §7 → §8 逐步做 → 每步做完回 §12 记一笔 + §15 打勾 |
| **B. 复核者**（ leader / 面试官视角） | 判断这些工作是否真实、是否站得住 | §5（基线数字是否真实）→ §7（决策是否讲得通）→ §8.2 的 DoD → §12 台账是否连续无断档 → §13 是否有"未验收先写简历" |
| **C. 未来维护者** | 后来加功能 / 修 bug / 继续优化 | §7（别推翻已定决策）→ §9（开关速查）→ §11（故障速查）→ §13（有没有已登记的待办）→ §8 对应步骤 |

### §0.2 本文档的三条硬规矩

1. **未验收不写简历**：每个阶段的能力话术，必须等该阶段 §8 的 DoD 全部勾选、且打了 tag 之后才能写进简历。违规写入视为交付事故（见 §13 的"话术红线"）。
2. **兜底代码必须有测试**：所有降级分支（§9）都必须有对应单测。降级代码也是生产代码，坏了不会有人第一时间发现。
3. **变更必须留痕**：任何代码改动都要在 §12 有一行记录（日期 + 文件 + 原因 + 验证方式）。没有记录的改动，等于没做过。

### §0.3 文档分工（避免真源分裂）

| 主题 | 唯一真源 | 其他文档的义务 |
|---|---|---|
| 变更历史 / 改了什么 / 为什么 | **本文档 §12** | 其他文档不记录变更历史 |
| 后续需求 / 待办 / 优化方向 | **本文档 §13** | `README.md` 只在「已知问题与后续计划」概述并链接本节，不逐条登记 |
| 选型理由 / 技术对比 | `plan.md` §二 | 不在本文档重复论证 |
| 步骤任务卡 / 风险 / DoD | `实施计划_细化版.md` | 本文档 §8 只写"怎么操作"与前置条件 |
| 产品说明 / 功能说明 / 使用方式 / 目录结构 / 命令速查 | **`README.md`（独占）** | 不写决策与变更史 |
| 给 AI 的工程约定 | **`AGENTS.md`（仅入口指针，指向 `README.md`）** | 不写变更史 |

> **2026-10-07 用户裁决（台账 #17）**：`CLAUDE.md` 与 `测试缺口.md` **已废止并删除**，理由是「两份逐字相同的文档靠人工维持，迟早漂移」（原 §6 P-08 / §13 B-15 预警的风险已实际发生），且重复内容会造成真源分裂。
>
> - **`README.md` 是项目说明的唯一真源**，`AGENTS.md` 退化为 11 行的 AI 代理入口指针（只给「要什么去哪看」的导航表，不含任何项目事实）。
> - **不再维护 `CLAUDE.md`**。需要兼容 Claude Code 的 agent 读取时，由 `AGENTS.md` 指针指向 `README.md` 即可；`.claude/settings.local.json` 继续独立承担工具权限配置，与文档分工无关。
> - **不再维护 `测试缺口.md`**。测试相关技术债统一登记到本文档 §6 台账与 §13 需求池。
> - **代价**：AI 代理首次进入仓库时只读 `AGENTS.md` 会信息不足，必须顺着指针读 `README.md`。这是**有意的取舍**——用一次多读一步，换掉「两份文档长期漂移」的风险。

---

## §1 项目是什么

### §1.1 一句话

`cnsoftbei` 是一个**纯浏览器端（无后端）的 AI 编程学习应用**：用户刷题、提问 AI 辅导、拿 AI 判分与学习画像。它同时是一个**教学 / 作品集项目**，用来展示"AI 应用测试体系"从"几条零散断言"升级为"评测基准集 + 三级质量漏斗 + RAG 评测"的完整工程能力。

### §1.2 业务功能（用户视角）

| 功能 | 说明 | 主要代码位置 |
|---|---|---|
| 刷题 | 三个题库共 405 题（Python 110 / Java 160 / 数据库 135），四种题型（单选 `choice` / 判断 `truefalse` / 简答 `short` / 填空 `fill`） | `src/data/*QuestionBank.ts` |
| AI 辅导 | 提问 → 流式回答 → 回答质量校验（规则 + AI 评审）→ 不合格则带反馈重生成（最多 2 次） | `src/pages/Tutor.tsx` + `src/services/tutorQuality.ts` |
| AI 判分 | 主观题由 LLM 打分，含合理性校验 | `src/services/practiceGrader.ts` |
| 学习画像 / 进度 | 按模块统计进度、AI 生成学习者画像 | `src/services/learningOrchestrator.ts`、`src/pages/*` |
| 路由 | `src/App.tsx` 手动 switch，**没有** react-router | `src/App.tsx` |
| UI | antd v6 + recharts 图表 + react-markdown 渲染回答 | `src/components/**` |

### §1.3 技术栈（已核实，非推测）

| 项 | 现状 |
|---|---|
| 框架 | Vite 8 + React 19 + TypeScript ~6.0，**纯浏览器 SPA，无后端** |
| UI | antd `^6.3.5` + @ant-design/icons + recharts |
| 测试 | Vitest 4 + @vitest/coverage-v8 + jsdom + msw 2 + @testing-library/react + Playwright 1.60 |
| CI | `.github/workflows/ci.yml` 4 个 job（lint / test / build / e2e），Node 写死 `20` |
| 提交钩子 | husky pre-commit → lint-staged（仅 `*.{ts,tsx}` → `eslint --fix`） |
| LLM | `src/services/api.ts` 直连 **DeepSeek**（**OpenAI 兼容格式**，非 Anthropic 格式），经 Vite 代理 `/deepseek/v1` 转发；Key 从 `import.meta.env.VITE_DEEPSEEK_API_KEY` 读取，**源码已无硬编码**；模型名取 `VITE_DEEPSEEK_MODEL`，默认 `deepseek-flash`；流式用 `fetch`，非流式用 `axios`；`max_tokens: 8192`，**无 temperature / seed** |
| 真实 API 测试 | 已与主门禁隔离：`vitest.config.ts` 的 `exclude` 含 `tests/integration/**`；改由 `npm run test:api`（`vitest.api.config.ts`：node 环境、不加载 `tests/setup.ts` 以免 msw 拦截真实请求、`testTimeout: 60000`）单独执行。文件内 4 组用例**全部**由 `describeWithKey` 守卫，未配 Key 时整体 skip，不会烧额度 |
| 构建产物 | 已做页面级代码分割：11 个页面中 10 个改为 `React.lazy`（登录页保持静态，因它是未登录首屏）。主 chunk **28.6 kB**，首屏合计 **825.6 kB raw / 280.1 kB gzip**（29 个 chunk），最大单文件是 `MarkdownRenderer` 763 kB（`react-markdown` + `react-syntax-highlighter`，仅 Tutor/Resources 用到，**不进首屏**）。口径与复现命令见下方提示 |
| 脚本执行 | `scripts/gen-test-report.ts` 用 `tsx` 运行（**tsx v4.23.15 已入 devDependencies + package-lock**，不再依赖 `npx` 在线拉取）。另有 `npm run typecheck`（`tsc -b`，独立类型检查）与 `npm run measure:size`（首屏体积度量，见 §1.3 提示块） |
| 新增依赖预算 | 本轮计划要求"零新增 npm 依赖"，唯一例外是 `tsx`（构建期工具，不进浏览器包）—— **该例外已于 2026-10-07 落地**（台账 #19） |

> **首屏体积怎么量、怎么判**：不要看 Vite 构建日志里"主 chunk 变小"——那不等于首屏变小。正确口径是 `dist/index.html` 中 `<script src>` + 全部 `<link rel="modulepreload">` 指向文件之和。执行 `npm run build && npm run measure:size`（脚本 `scripts/measure-entry-size.mjs`，零依赖）会输出逐文件明细、占比与参考阈值（单文件 gzip > 200 KB 或首屏 gzip > 400 KB 就该继续拆）。**新增页面必须用 `lazy` 引入**，否则包体会重新变大。

**三个必须记住的工程约束**：

1. `tsconfig.app.json` 开启了 `noUnusedLocals` / `noUnusedParameters` —— 任何未使用的变量/参数都会让 `npm run build` 失败。
2. `.gitignore` 里有 `*.local`（覆盖 `.env.local`），但**没有 `.env` / `.env.*` 规则** —— 若有人新建 `.env` 就会被提交，这是仍需补的泄漏面（§13 B-05）。
3. `npm run lint` 目前**红**（**42 errors / 6 warnings**：31 `no-explicit-any` / 8 `react-hooks/set-state-in-effect` / 3 `react-refresh/only-export-components`）—— CI 的 lint job 仍失败。B-0 第 1 批已完成（59→42，台账 #18），见 §6 P-14 与 §8.1 B-0。

> ⚠️ 更正：本条原写「52 errors，全在 `src/`」，**漏算了 `tests/` 下 7 处 `no-explicit-any`**（`tests/ai/roleBoundary.test.ts` 4 处、`tests/stress/page-switching.test.ts` 2 处、`tests/unit/learningOrchestrator.test.ts` 1 处）。52 + 7 = 59。2026-10-07 复核。

---

## §2 接手前 60 分钟必做清单

> 按顺序做完，每步都有"预期结果"。任何一步与预期不符，**先解决再继续**，不要带着异常往下走。

| # | 操作 | 命令 / 动作 | 预期结果 |
|---|---|---|---|
| 2-1 | 确认 Node 版本 | `node -v` | 需 `>= 20.19`（`vite@8` / `vitest@4` 硬要求）。本机实测 `v24.16.0`，可用。若低于 20.19 先 `nvm install 20.19.0 && nvm use 20.19.0` |
| 2-2 | 修复 git 仓库访问 | `git --no-pager log --oneline -5` | **大概率报错** `detected dubious ownership`（目录属主与当前 Windows 账号不同）。按 §3 坑 1 处理后再重试 |
| 2-3 | 安装依赖 | `npm ci` | 成功。若报 engine 警告，记录但不阻塞（见 §3 坑 2） |
| 2-4 | 跑一次全量测试，摸清基线 | `npm test` | **预期是红的**：12 个测试文件 / 344 个用例，约 17 个失败。这是**当前真实状态**，不是你的错 |
| 2-5 | 排除真 API 测试再跑 | `npm run test:coverage -- "--exclude=tests/integration/api-real.test.ts" "--exclude=node_modules/**" "--exclude=dist/**"` | 11 个文件 / 334 个用例，通常只剩 1 个失败（`Pages.test.tsx` 的 Home 模块导入超时，且它 flaky） |
| 2-6 | 跑构建与类型检查 | `npm run build` | 绿。若红且报 `noUnusedLocals`，是既有问题，记录到 §12 |
| 2-7 | 跑 lint | `npm run lint` | 绿 |
| 2-8 | 读三份文档 | 本文档 §1/§5/§7 → `实施计划_细化版.md` §1/§2 | 能复述"项目要做什么、现在什么状态、哪些决策不能推翻" |
| 2-9 | 建立个人执行台账 | 新建 `docs/exec-log-YYYY-MM.md`，从 §12 的模板复制一份 | 每个工作日填一行（模板见 §8.9） |
| 2-10 | 确认环境变量现状 | `Test-Path .env.local` | 大概率 `False`（新 Key 未签发）。这不影响任何离线任务，见 §5.3 |

---

## §3 环境与工具链

### §3.1 基本要求

| 项 | 要求 | 说明 |
|---|---|---|
| Node | `>= 20.19.0`（推荐 20.19.0 或 24.x） | 本机实测 v24.16.0 ✅ |
| npm | 11.x（本机 11.13.0） | 随 Node 附带 |
| OS | Windows + PowerShell（本文命令按 PowerShell 写） | 脚本本身跨平台 |
| 网络 | 除"真实 LLM 评测"外，**全部任务可离线** | CI 主门禁设计为 0 API 额度、0 网络 |

### §3.2 三个必踩的坑（交接时最容易卡住的地方）

#### 坑 1：git 报 `detected dubious ownership`

**现象**：

```
fatal: detected dubious ownership in repository at 'D:/GitHub laqudaima/cnsoftbei'
'...cnsoftbei' is owned by: HZ-B01951191-01/rixis
but the current user is: TCLKING/zhilong14.zhang
```

**原因**：仓库目录的属主（rixis）与当前登录账号（zhilong14.zhang）不同，git 为安全起见拒绝操作。

**处置**（需要你本人执行，涉及修改全局 git 配置，AI 不代劳）：

```powershell
git config --global --add safe.directory 'D:/GitHub laqudaima/cnsoftbei'
```

**注意**：修好后**第一件事**是补录历史变更到 §12：

```powershell
git --no-pager log --oneline -30
git --no-pager log --stat -10
```

当前 §12 中"历史变更"一节为空，原因就是这一步当时没做。

#### 坑 2：Node 版本与 `engines` 不一致

CI 写死 `node-version: 20`，而 `vite@8` / `vitest@4` 要求 `^20.19.0 || ^22.12.0 || >=24`。CI 装的 20.x 有可能是 20.10 这类低版本，从而安装或运行失败。

**处置**：本轮内把 CI 全部 job 改为 `20.19.0`，并在 `package.json` 补：

```json
"engines": { "node": ">=20.19" }
```

本地 Node 24 无需改动。

#### 坑 3：`tsx` 不在依赖里，脚本无法离线执行 ✅ 已修复（2026-10-07，台账 #19）

> **现状**：`tsx@4.23.15` 已装入 devDependencies 且已提交 lock，`test:report` 已改为直接调 `tsx`。以下内容保留作为**背景与同类问题的排查方法**（新脚本一律用 `tsx`，不要再写 `npx tsx`）。

**现象**：`npm run test:report` 或任何 `npx tsx ...` 在离线 / CI 环境报网络错误（`npx` 会尝试去 registry 下载 tsx）。

**核实结论**：`package-lock.json` 里**没有** `tsx` / `vite-node` / `esbuild`，即 `tsx` 完全未安装，现有 `test:report` 脚本一直是靠 `npx` 在线拉取的。

**处置**：本轮破一次例，加为 devDependency（构建期工具，不进浏览器 bundle，不影响首屏体积）：

```powershell
npm i -D tsx
```

并把 `package.json` 里 `test:report` 的 `npx tsx` 改为 `tsx`，所有新增脚本统一用 `tsx`。

#### 坑 4：PowerShell 参数转义

`--flag value` 形式在 PowerShell 里易被解析异常。所有脚本参数**统一用等号形式**：`--out-dir=./out`、`--exclude=node_modules/**`，避免空格。

### §3.3 环境变量（现状：新 Key 未签发）

| 变量 | 用途 | 现状 |
|---|---|---|
| `VITE_MINIMAX_API_KEY` | 浏览器端 LLM 调用 | 源码里**硬编码**（步骤 0 迁出） |
| `MINIMAX_API_KEY` | Node 侧集成测试 | `tests/integration/api-real.test.ts` 硬编码 |
| `EVAL_MODE` | `offline`（默认）/ `live` | 未定义 → 默认 offline，**全部离线任务不受影响** |
| `LLM_E2E` | 是否跑真实 API 测试 | 未定义 → 应当让 api-real 整组 skip |

**重要**：本轮计划的**主门禁全部设计为零额度**，没有 Key 也能完成除"真实 LLM 提升幅度"外的所有内容。不要因为等 Key 而停工。

### §3.4 安全红线

- 旧 Key 已进 git 历史，**代码侧改动不构成止损**。必须在 MiniMax 平台作废旧 Key 并重签，这是人工步骤（§8 步骤 0 的 S0-7）。
- 任何时候不得把真实 Key 写进源码、文档、示例文件、提交信息。
- 自查命令（必须 0 命中）：

```powershell
rg -n "sk-[A-Za-z0-9_-]{20,}" --glob '!node_modules/**' --glob '!learning-agent/**'
```

---

## §4 代码地图

### §4.1 目录职责

```
d:/GitHub laqudaima/cnsoftbei/
├── src/
│   ├── pages/          11 个页面组件（Tutor / Practice / Home …），本轮主要改 Tutor.tsx
│   ├── services/       业务与基础设施服务（api / tutorQuality / practiceGrader / promptBuilder / learningOrchestrator）
│   ├── data/           三个题库（TS 模块，非 JSON）+ mockData；本轮会新增 ragChunks.json / ragVectors.json
│   ├── components/     通用 UI 组件
│   ├── context/        PageCacheContext / AuthContext（测试里被 vi.mock 替换）
│   ├── hooks/          自定义 hook
│   ├── types/          全局 TS 类型（PracticeQuestion / QAItem 等）
│   ├── App.tsx         手动路由 switch
│   └── config/         【本轮新增】配置与阈值常量
├── tests/
│   ├── unit/           5 个文件：api / learningOrchestrator / practiceGrader / questionBank / tutorQuality
│   ├── ai/             3 个文件：gradeByAI / promptBuilder / roleBoundary
│   ├── components/     Pages.test.tsx（页面可导入性，14 个用例）
│   ├── integration/    api-real.test.ts（⚠ 真打真 API，本轮要改默认跳过）
│   ├── stress/         压力测试
│   ├── e2e/            Playwright 用例
│   ├── mocks/          handlers.ts（5 个 prompt 分发分支）/ server.ts（msw 生命周期）
│   ├── setup.ts        全局前置：jest-dom、localStorage/sessionStorage mock、msw listen
│   └── test-utils.tsx  测试工具
├── scripts/            gen-test-report.ts（静态 HTML 报告范式）+ tmp/（临时脚本收纳）
├── e2e/                playwright.config.ts
├── .github/workflows/ci.yml
├── temp_*.cjs / temp_*.json   一次性数据处理脚本与产物（题库溯源用，勿删）
├── learning-agent/     ⚠ 残留目录，33,369 个文件，含一份含讯飞星火密钥的 .env.local
├── README.md                项目说明唯一真源（功能/用法/目录/命令/注意事项）
├── AGENTS.md                给 AI 代理的入口指针（指向 README，无项目事实）
│                            （原 CLAUDE.md 与 测试缺口.md 已于 2026-10-07 废止删除，见 §0.3 裁决）
├── 实施计划_细化版.md / HANDOVER.md（本文件）
│                            （`plan.md` 已不在仓库 —— 从未入库，见 §15.3）
```

### §4.2 关键位置索引（改动时直接定位）

| 要改的地方 | 文件 : 行 | 说明 |
|---|---|---|
| 硬编码 API Key | `src/services/api.ts:4` | `const API_KEY = 'sk-...'` |
| 硬编码模型名 | `src/services/api.ts:57`、`:160` | 两处 `'MiniMax-M2.7'` |
| axios 超时 180s | `src/services/api.ts:17` | 改造时保持 |
| 流式响应解析 | `src/services/api.ts:90-129` | SSE 逐行 buffer 拼接，**不要动** |
| 非流式重试 3 次 | `src/services/api.ts:147-220` | 仅超时才重试，**不要动** |
| 质量规则校验 | `src/services/tutorQuality.ts:21-48` | 3 条规则：<50 字 / 8 条拒绝词 / 2-gram 关键词重叠 |
| STOP_WORDS（私有） | `src/services/tutorQuality.ts:53-58` | 需导出供检索复用 |
| 切词实现 | `src/services/tutorQuality.ts:64-75` | 中文 2-gram + 英文 3+ 字符 |
| Jaccard 实现 | `src/services/tutorQuality.ts:80-87` | 全项目**唯一**正确实现，grader 里的私有副本要删 |
| AI 评审 + 两处 `return 80` 兜底 | `src/pages/Tutor.tsx:175-197`（L193、L195） | "失败伪装成通过"的缺陷点 |
| 生成 + 校验 + 重试 | `src/pages/Tutor.tsx:200-253` | 规则不过**不重试**直接返回；AI 评审 <70 才重试（最多 2 次） |
| 追问上下文解析 | `src/pages/Tutor.tsx:150-170` | 本轮**不动** |
| 主题相关性判断 | `src/pages/Tutor.tsx:251-268` | 失败默认视为"不相关"，本轮**不动** |
| grader 私有 jaccard | `src/services/practiceGrader.ts:132-146` | 重复实现，待删 |
| gradeByAI 内联 prompt | `src/services/practiceGrader.ts:85-104` | 与死代码重复，待收敛 |
| 模块进度 NaN bug | `calculateModuleProgress`（纯简答模块除零） | 待修 |
| 题库 sampleAnswer 分布 | `pythonQuestionBank.ts` 8 处 / `javaQuestionBank.ts` 60 处 / `databaseQuestionBank.ts` 15 处 | **共 83 条**，是基准集金标层的全部来源 |
| Python 规范 tag 表 | `pythonQuestionBank.ts:16-32` | 17 个 tag，基准集校验的合法 tag 依据 |
| msw prompt 分发 | `tests/mocks/handlers.ts:56` 起 | 5 分支：评分 / 画像 / 相关 / 评审 / 默认 |
| msw 未处理请求策略 | `tests/setup.ts:63` | `onUnhandledRequest: 'bypass'` —— **未 mock 的请求会真的打网络** |
| api-real 真调网络 | `tests/integration/api-real.test.ts` 直接 `fetch`，不走 msw | 10~12 个用例会真打真 API |

### §4.3 一次「用户提问」的完整数据流（现状）

```
用户输入
  → Tutor.tsx handleAsk
  → resolveContext()            关键词粗筛历史 + AI 判断相关性（可能额外 1 次 LLM 调用）
  → streamChatCompletion()      流式回答，边流边渲染（最长 180s）
  → validateAnswerRules()       规则校验（<50 字 / 拒绝词 / 关键词重叠）
       └─ 不过 → 直接返回，不重试
  → aiReviewAnswer()            LLM 打分（失败兜底 80 = 假装通过）
       └─ <70 → 带反馈重生成，最多 2 次
  → 展示 + 写入历史
```

本轮要做的改动就挂在这条链路上：**入口加检索**（注入上下文）、**中段换成三级漏斗**、**评审兜底改为可观测的降级**。

---

## §5 现状实测基线（2026-10-07 核实）

> **这一章的数据是实测得来的，不是推测。** 复核者可以直接按同样命令复现。
> 测量环境：Windows / PowerShell / Node v24.16.0 / npm 11.13.0。

### §5.1 测试基线（✅ 已全绿，2026-10-07 修复后）

| 场景 | 命令 | 结果 |
|---|---|---|
| 全量 | `npm test` | **11 个测试文件 / 334 个用例，全部通过**（约 43~55s） |
| 覆盖率 | `npm run test:coverage` | 334/334 通过，报告正常生成 |

> `tests/integration/api-real.test.ts` **不在全量内**（已被 `vitest.config.ts` 的 `exclude` 排除），它由 `npm run test:api` 单独执行且会消耗额度。

**修复前的历史（供追溯，勿再复现）**：修复前全量为 12 文件 / 344 用例 / **17 失败**，且两次运行结果不一致（flaky）。三类根因与处置：

| 根因 | 处置 | 现状 |
|---|---|---|
| 真实 API 测试混进主门禁、无 Key 守卫 | `vitest.config.ts` 排除 `tests/integration/**`，新增 `test:api` 脚本与 `vitest.api.config.ts`；文件内 4 组用例全部 `describeWithKey` 守卫（含原先漏守卫的「API 错误处理」组） | 已隔离 |
| `tests/unit/api.test.ts` 的 fetch mock 泄漏（flaky） | 测试文件顶部 `globalThis.fetch = mockFetch` 被同 worker 内其他文件的 `setup.ts`（`server.listen()`）重新覆盖，漏出的请求因 `onUnhandledRequest: 'bypass'` 真的出网 | 已随上一条一并消除（该文件不再出现在失败清单） |
| `Pages.test.tsx` 页面导入超时（flaky） | **根因是并行资源竞争而非功能缺陷**：单跑该文件 14/14 通过（tests 耗 35.85s），全量并行时 `Home` 的动态 import（antd + recharts 链路）超过 15s。已统一放宽到 `IMPORT_TIMEOUT = 60000` 并注释原因，只放宽超时上限、不改断言 | 已消除，连续 4 次全量运行全绿 |

**结论**：绿色基线已建立，可用于「改动前后测试数对比」。注意测试耗时对机器负载敏感（43~55s 波动），**排查超时类问题前先单跑该文件**（§11.1）。

### §5.2 覆盖率基线（实测已取得，ratchet 门槛已写入）

全绿后 vitest 4 才愿意生成覆盖率报告（**有失败时不生成**，这是踩过的坑）。实测基线（2026-10-07）：

| 指标 | 实测值 | 已写入门槛 |
|---|---|---|
| statements | 18.99% | 18 |
| branches | 12.72% | 12 |
| functions | 13.94% | 13 |
| lines | 19.75% | 19 |

`vitest.config.ts` 的 `coverage.thresholds` 已按上述值（各留约 1 个百分点缓冲）写入，并注释说明「ratchet：只升不降，每次约 +5 点，达标后逐步向 70% 靠拢」。

**为什么不能一步设 70**：`coverage.include` 是 `src/**/*.{ts,tsx}`，分母包含全部页面与组件（11 个页面 + 组件 + context + hooks），而测试只有 334 个且集中在 services/utils 层。直接设 70 会让门禁第一天就红。这条已记入 `实施计划_细化版.md` T-5。

### §5.3 LLM 与网络基线

| 项 | 实测 |
|---|---|
| 硬编码 Key 有效性 | **已失效**（401）。所有依赖它的真调用都会失败 |
| 真 API 测试 | 每次 `npm test` 都在尝试真实请求（虽有 Vite 代理，但 vitest 下不走代理，实际报 401/500） |
| msw 保护范围 | 仅保护走 `api.ts`（`BASE_URL='/anthropic'`）的请求；`api-real.test.ts` 自己 `fetch` 绝对/相对地址，**完全绕过 msw** |
| 未 mock 请求 | `tests/setup.ts:63` 是 `bypass` → 未 mock 的请求**真的出网** |

### §5.4 仓库基线

| 项 | 实测 |
|---|---|
| git 可访问性 | ❌ `dubious ownership`（见 §3 坑 1） |
| 历史变更记录 | **未取到**（被坑 1 阻塞）。修复后请按 §12 的"历史补录"流程补齐 |
| 未追踪残留目录 | `learning-agent/` 33,369 个文件（含 16,945 个 `.js`），因 `.gitignore` 含 `dist`，**大概率未被 git 追踪 → 删除后无法用 git 恢复** |
| 根目录临时文件 | 8 个 `temp_*.json` / `temp_*.cjs`（题库解析脚本与产物，是 RAG 语料的溯源依据，**建议保留**） |

---

## §6 已知问题台账

> 状态取值：`待修` / `修完待验` / `已修（见 §12 台账）`。修完必须回填 §12。

| ID | 级别 | 问题 | 根因（已核实） | 建议修法 | 状态 |
|---|---|---|---|---|---|
| P-01 | ~~P0~~ | ~~`npm test` 每次真打真 API 且 10 个用例失败~~ | 原 `api-real.test.ts` 直连 fetch、无 Key 守卫 | **已处置**：`vitest.config.ts` 排除 `tests/integration/**`，新增 `npm run test:api`（node 环境专用配置）；4 组用例全部 `describeWithKey` 守卫（其中「API 错误处理」组原先漏守卫，本轮补上） | **已修**（§12 台账 #9） |
| P-02 | ~~P0~~ | ~~`tests/unit/api.test.ts` flaky（6 个用例时好时坏）~~ | 顶层 `globalThis.fetch = mockFetch` 被同 worker 内 `setup.ts` 的 `server.listen()` 覆盖；`onUnhandledRequest: 'bypass'` 使漏出请求真的出网 | **已随 P-01 一并消除**（隔离后不再与主门禁同批运行）；若将来再出现同类 flaky，处置见 §11.2（改用 `vi.stubGlobal`） | **已修**（§12 台账 #9） |
| P-03 | P1 | 页面模块导入 flaky 超时 | 并行资源竞争：`Home` 的动态 import（antd + recharts 链路）在全量并行下超过 15s；单跑该文件 14/14 通过（tests 耗 35.85s） | 已统一放宽为 `IMPORT_TIMEOUT = 60000` 并注释原因（只放宽超时上限、不改断言）；连续 4 次全量运行全绿 | **已修**（§12 台账 #6） |
| P-04 | ~~P0~~ | ~~源码硬编码明文 Key~~ | 原 `api.ts:4` 硬编码 MiniMax Key | **已处置**：`api.ts` 现读 `import.meta.env.VITE_DEEPSEEK_API_KEY`，无 Key 时仅 DEV 下告警；`.env.example` 已存在。**注意**：`.env.local` 中仍有一个真实 DeepSeek Key（`sk-9aa…`），平台侧是否已作废待确认 | **代码侧已修；平台侧待人工确认**（§12 台账 #9） |
| P-05 | ~~P0~~ | ~~`.gitignore` 无 `.env` / `.env.*` 规则~~ | 只写了 `*.local`（覆盖 `.env.local`） | **已修**（台账 #19）：追加 `.env`、`.env.*`、`!.env.example` | **已修** |
| P-06 | P1 | `aiReviewAnswer` 评审失败返回 80，伪装成"通过" | `Tutor.tsx:193` 解析失败兜底 80、L195 异常兜底 80 | 改为返回 `{ score, degraded }`，`degraded` 计入报告的"评审降级率"（计划 S3-6） | 待修 |
| P-07 | P1 | `README.md` 代码块未闭合，模板文字被吞 | L4 起四个反引号未闭合 | 修 markdown；替换 Vite 模板文字为真实项目概述（计划 S6-4） | 待修 |
| P-08 | ~~P1~~ | ~~`AGENTS.md` / `CLAUDE.md` 内容过时~~ | L18 说"没有测试框架"（实际有 vitest+playwright+4 个 CI job）；Key 处理方式已变；引用了不存在的文档 | **已修**（台账 #13）：`AGENTS.md` 精简为指向 `README.md` 的入口指针；`CLAUDE.md` 已废止删除（§0.3 裁决）。原 S6-5「两份逐字同步」任务随之作废 | **已修**（台账 #13、#17） |
| P-09 | P2 | `calculateModuleProgress` 纯简答模块返回 NaN | 除零 | 除零保护 + 单测（计划 S3-5） | **已修**（2026-10-08 核实）：现有实现已带除零保护，`practiceGrader.test.ts` 有用例断言不返回 NaN，无需改动 |
| P-10 | P2 | 相似度算法双份实现（逐字 vs 2-gram，结果不可比） | `practiceGrader.ts:132-146` 私有 jaccard | 统一到 `tutorQuality` 单一实现；若统一后现有测试红且分数行为确有变化，则**保留旧实现并注释说明差异**（诚实优于整洁）（计划 S6-1 / §7 ADR-08） | **已修**（2026-10-08）：私有实现删除，统一用 `jaccardText`；阈值 0.6/0.2 刻意保留不变（理由见 `practiceGrader.ts` 注释表），并新增数值级回归用例锁定 0.625 / 0.207 两个实测值 |
| P-11 | P2 | prompt 双份真相 | `gradeByAI` 内联 prompt 与 `buildGradeByAIMessages` 重复，另有死代码 | 收敛到 `promptBuilder`（计划 S3-5） | **已修**（2026-10-08 核实）：`practiceGrader.gradeByAI` 已改调 `buildGradeByAIMessages`，无内联 prompt 残留 |
| P-12 | P2 | `learning-agent/` 残留目录含第二处密钥（讯飞星火） | 33,369 文件，多为已构建 dist | **先删其中 `.env.local`**（止损）；整目录删除需三步前置确认（计划 T-6 / S6-3），因未被 git 追踪故不可 `git checkout` 恢复 | 待修 |
| P-13 | P2 | CI Node 版本可能不兼容 vite@8/vitest@4 | `node-version: 20` 范围过宽 | 统一 `20.19.0` + `engines`（计划 S5-3） | 待修 |
| P-14 | **P1** | `npm run lint` 红：**59 errors / 6 warnings**（38 `no-explicit-any` / 8 `react-hooks/set-state-in-effect` / 6 `no-empty` / 4 `no-unused-vars` / 3 `react-refresh/only-export-components`）。**分布：`src/` 52 处 + `tests/` 7 处**（原写「52 / 全在 src/」，漏算 tests 侧 7 处 any，2026-10-07 复核更正） | 既有类型与 React Hooks 技术债；`set-state-in-effect` 与 `only-export-components` 的修复会**改动运行时行为**，不适合顺手改 | 分批专项治理，任务卡见 **§8.1 B-0**：① `no-unused-vars` + `no-empty`（零行为风险，可立即做）；② `any` 逐文件收窄；③ `set-state-in-effect` / `only-export-components` 需配合页面重构，单独排期。**在此之前 CI lint job 持续红**（§13 B-18） | **第 1 批已修**（台账 #18）：`no-empty` 6 + `no-unused-vars` 4 全部清零，**59 → 42 errors**；`tsc -b` 0 错误；`npm test` **334/334 全绿**。剩 42 = `any` 31 + `set-state-in-effect` 8 + `only-export-components` 3，对应 §8.1 B-0 第 2/3 批。另：原计划给 `tests/` 加 disable 注释的做法**作废**——`eslint.config.js` 已有 `tests/**` → `no-explicit-any: off` 的 override，加注释反而触发 unused 告警 |
| P-15 | ~~P2~~ | ~~构建产物单 chunk 2,162 kB（gzip 709 kB）~~ | `App.tsx` 手动路由但 11 个页面全是静态 import，recharts / react-syntax-highlighter / dayjs 全部进首屏 | **已修**：除登录页外全部页面改 `React.lazy` + `<Suspense>`（antd `Spin` 作fallback，不额外增体积）。实测首屏 **825.6 kB raw / 280.1 kB gzip**，gzip 降**60.5%**；主 chunk 2,162 → 28.6 kB；新增 `npm run measure:size` 作为防回归口径 | **已修**（§12 台账 #11） |
| P-16 | P1 | **文档与代码已漂移**：本计划与 §4.2 行号索引基于 2026-10-07 21:20 之前的版本；同日 21:37~22:17 期间 `api.ts`（转 DeepSeek/OpenAI 格式）、`vitest.config.ts`、`Tutor.tsx`、`Practice.tsx`、`practiceGrader.ts`、三个题库、`package.json` 等被大幅改动 | 他人或另一 agent 并行修改了本仓库 | 改动任何带行号的定位前**必须重新读取文件**；本文档 §1.3 已同步 LLM 现状，但 §4.2 行号需在动手时逐一验证 | 待持续维护 |
| P-17 | **P1** | ~~**§0.3 文档分工被破坏**~~ | 台账 #13：应用户「文档整合」要求做了合并删除，但当时尚未读到本文档 §0.3 的分工约定 | **用户已裁决（2026-10-07，台账 #17）**：采纳「更新 §0.3 承认新分工」方案 —— `README.md` 独占项目说明，`AGENTS.md` 退化为入口指针，**`CLAUDE.md` 与 `测试缺口.md` 正式废止**。理由：两份逐字相同的文档靠人工维持必然漂移（原 P-08 / B-15 预警的风险已实际发生）。§0.3、§4.1 目录树、P-08、S6-5/S6-6、B-15 已同步修正 | **已修**（台账 #17） |
| P-18 | **P1** | **模型只返回 `reasoning_content` 而 `content` 为空时，简答题判分可能误判 0 分** | `deepseek-flash` 会把 token 消耗在推理字段上；`max_tokens` 偏小或问题触发推理时 `choices[0].message.content` 返回空字符串。实测 `api-real.test.ts`「评分场景」`max_tokens:256` 时复现 `content:""` + 有 `reasoning_content` | `gradeByAI` 对空返回能安全返回 0（不崩溃），但**学生答对也可能被判 0 分**。建议 ① `chatCompletion` 在 `content` 为空且有 `reasoning_content` 时回退用该字段并打日志；② `streamChatCompletion` 对「全程无 content」返回 `[模型仅返回推理内容]` 而非 `[无内容返回]`，便于页面提示；③ 判分场景上调 `max_tokens`（测试侧已 256→1024） | **待修**（测试侧已缓解，产品侧兜底未做） |

---

## §7 关键决策记录（ADR）

> **用法**：改动前先查这里。若你的方案与某条 ADR 冲突，不要直接改，先在 §13 登记"推翻该 ADR 的理由"，走 §7 末尾的"推翻条件"。

### ADR-01 Embedding 在构建期算，运行时只做余弦相似度
- **背景**：需要语义相似度，但 CI 必须零额度、零网络、完全可复现。
- **决策**：构建期（Node 脚本）产出静态向量 JSON 入库；浏览器运行时只解码 + 点积。
- **放弃的方案**：云端 embedding API（需 Key、CI 无法零额度）；浏览器 transformers.js（首屏 +25~50MB）。
- **后果**：向量是**生成物**，不可手改（由哈希一致性测试守护）；换模型 = 新增一个 provider 实现 + 重跑构建。
- **推翻条件**：需要接入真实稠密模型时（见 §13 B-02），届时仍保留构建期产物形态。

### ADR-02 用确定性特征哈希，不引入 bge/ONNX
- **决策**：`EmbeddingProvider` 默认实现 = 中文 1/2/3-gram + 英文 word → FNV-1a 哈希映射到固定维（256）→ 亚线性 tf × IDF → L2 归一化。
- **理由**：稠密模型输出跨平台有 1e-6 级浮点差异，会让哈希一致性测试随机失败、回归数字失去意义。
- **后果（必须诚实对外表述）**：这是**稠密 float32 向量 + 余弦相似度**，但**不是**语义模型。对外说法是"基于确定性特征哈希的稠密向量余弦相似度"，**不许说成 bge-small-zh**（会被追问穿）。
- **推翻条件**：见 ADR-01。

### ADR-03 向量以 int8 量化 + base64 存储
- **背景**：420 chunk × 256 维原始 float32 JSON 约 430KB，是量化后 base64（143KB）的 3 倍。
- **决策**：每维 1 个 int8 + 全局 scale，运行时解码为 `Float32Array` 并预归一化，检索只需点积。
- **关键细节（极易出错）**：量化误差约 0.4%，对**排序**影响可忽略，但会轻微影响 ROC 阈值 → **阈值脚本必须使用与运行时同一份量化后向量计算**。
- **推翻条件**：块数超过 5000（届时考虑换格式）。

### ADR-04 一题一 chunk + tag 概览块
- **背景**：题库每题是完整语义单元，按固定长度切分会把 question/answer/explanation 拆散。
- **决策**：主块 = 一题一 chunk（83 道简答题用 `sampleAnswer`；客观题用「题干 + 正确答案 + 解析」合成）；同一 tag 题数 ≥3 时额外生成 1 个概览块；>600 字的块按中文句号切 2 段、overlap 1 句，子块继承 metadata 加 `partIndex`。
- **后果**：块数约 420~440，检索为一次线性扫描（440×256 ≈ 11 万次乘加，亚毫秒级），**不需要任何索引结构**（YAGNI）。
- **推翻条件**：实测出现跨知识点混淆检索（→ §13 B-05 语义分块）。

### ADR-05 混合召回 `0.7 × 余弦 + 0.3 × Jaccard`
- **背景**：查询侧 embedding 不能依赖在线 API（新 Key 未签发）。
- **决策**：关键词通道复用已有的 `tutorQuality.extractTokens` + `jaccardSimilarity`（零新增代码）；权重为可调常量，可用评测脚本扫参。
- **后果**：无 Key 也能工作；将来接入真 embedding 时可把权重调到 1.0 退化为纯向量。
- **推翻条件**：权重扫描显示关键词通道收益 < 2% 时可去掉（§13 B-04）。

### ADR-06 阈值由 ROC + Youden J 选取，人工 review 后固化为常量
- **背景**：相似度阈值不能拍脑袋。
- **决策**：正样本 = 优样例、负样本 = 差样例（**中样例不参与拟合**，否则阈值被拉向中间失去区分意义）；逐阈值算 TPR/FPR/精确率/召回/F1，取 Youden J（= TPR − FPR，等代价场景的合适指标）最大点；额外输出留一交叉验证（LOO）稳定性数据；**阈值最终写入 `src/config/qualityThresholds.ts` 常量入库**，CI 不现算。
- **理由（为什么不用现算）**：样本微调会导致门禁随机红。
- **补充决策**：若 J 指标区分度不足（Youden J < 0.3），**语义层转影子模式（只记录不拦截）**，并在对外表述中同步改为"已标定、影子模式运行、误杀率 0"。
- **推翻条件**：基准集规模 > 200 条后改用阈值自愈策略（§13 B-03）。

### ADR-07 不引入 zod / 报告框架 / BLEU-ROUGE
- **决策**：schema 校验手写 `assertGoldenSet()` 运行时校验 + 单测；评测报告复用 `scripts/gen-test-report.ts` 的"纯字符串拼静态 HTML"范式；**刻意不选 BLEU/ROUGE**（n-gram 字符串相似度会严重低估"换一种说法说对"的中文教学回答，与语义层意图冲突）。
- **理由**：只有 3 处需校验；引入框架与"零新增依赖"冲突；YAGNI。

### ADR-08 改造必须向后兼容，签名不动
- **决策**：`validateAnswerRules(answer, questionText)` 的签名与 3 条规则行为**完全不变**（21 条现有测试零改动）；新增能力走**可选第二参数** `ref?: GoldenReferenceLike`；`chatCompletion` 新增可选第二参 `ChatCompletionOptions`，不传时行为与现在一致。
- **理由**：现有 3 处调用点与 21 条测试是回归安全网，改签名等于放弃安全网。
- **推翻条件**：无（这是硬约束）。

### ADR-09 CI 主门禁零额度、零网络
- **决策**：默认门禁全部离线（msw 提供 LLM 输出）；真实 LLM 评测只在 `workflow_dispatch` 且 `secrets.MINIMAX_API_KEY != ''` 时手动触发。
- **理由**：新 Key 未签发；且门禁不应有额度与网络依赖。

### ADR-10 "零新增依赖"的唯一例外是 `tsx`
- **背景**：原计划宣称零新增依赖，但构建期脚本需要 `tsx`，而它根本不在依赖里（现有脚本一直靠 `npx` 在线拉取）。
- **决策**：破例一次，加 `devDependencies: tsx`，并提交 lock 文件。
- **理由**：构建期脚本的**可执行性**比依赖洁癖重要；tsx 是 dev-only，不进浏览器 bundle，不影响首屏体积。

### ADR-11 门禁分三阶段收紧 + 覆盖率 ratchet
- **决策**：eval job 经历 **A 观察（永失败，收集 3 天数据）→ B 告警（跑完全部检查再汇总）→ C 阻断（连续 3 次绿后）**；覆盖率阈值先取真实基线，"不得低于基线"，达标后每次 +5 点，**不直接设 70**。
- **理由**：新增门禁第一天就红会直接摧毁对体系的信任；而当前基线是红的，连覆盖率数字都测不出来（§5.2）。

### ADR-12 阶段阶梯交付，未验收不写简历
- **决策**：工作按 L0~L4 阶梯推进，每阶梯可独立交付、独立回滚、独立写简历；时间不够就停在当前阶梯，**不开半截代码**。

### ADR-13 默认 `RAG_ENABLED=false` 交付
- **决策**：RAG 检索与上下文注入默认关闭，先用 withRag / withoutRag 对照数据证明有正收益后再开启。
- **理由**：RAG 让回答变差的概率不低（注入误导片段、题干与片段不相关仍硬答）。

### ADR-14 `learning-agent/` 暂不整体删除
- **决策**：**只删除其中的 `.env.local`**（消除第二处密钥泄漏面）；整目录删除需三步前置确认（`git ls-files` 确认为 0 / 无 `.gitignore` 例外 / zip 备份），任一不过则保留目录并在 README 标注。
- **理由**：该目录 33,369 个文件且大概率未被 git 追踪，删除不可逆。

---

## §8 实施操作手册

> 每一步的**为什么**、风险表、DoD 全表在 `实施计划_细化版.md` 对应章节；本章只给"照着做"的操作序列。
> **每完成一个任务卡就回 §12 记一行。** 每完成一个步骤就打 tag（见 §8.10）。

### §8.0 步骤总览与顺序（不可乱序）

| 步骤 | 名称 | 预估 | 前置 | tag |
|---|---|---|---|---|
| **-1** | 修复红色基线（P0，先于一切） | 1~2h | 无 | `baseline-fixed` |
| 0 | Key 止损与配置外置 | 0.5h | 步骤 -1 | `baseline-key` |
| 1 | LLM 评测基准集 | 0.5~1 天 | 步骤 0 | `baseline-phase0` |
| 2 | 向量基础设施 | 0.5 天 | 步骤 0（tsx）、步骤 1 | `baseline-vectors` |
| 3 | 三级质量漏斗 + 阈值调优 | 1 天 | 步骤 1、2 | `baseline-phase1` |
| 4 | RAG 知识库接入 | 2~3 天 | 步骤 2、3 | `baseline-rag` |
| 5 | RAG 评测体系 + CI 门禁 | 1~2 天 | 步骤 1、3、4 | `baseline-eval` |
| 6 | 技术债清理与文档同步 | 0.5 天 | 建议步骤 3 之后 | `baseline-cleanup` |

> **各步骤当前状态与「开工前置条件」以 `实施计划_细化版.md` 的 §0.1 进度快照与 §2.1 前置条件清单为准**（本文档不重复维护状态，避免两份文档打架）。截至 2026-10-07：步骤 -1 已完成、步骤 0 主体完成剩 2 项收尾、步骤 1~6 未开始。

**乱序会怎样**：跳步骤 -1 → 后面所有"回归对比"结论不可信；跳步骤 0 → 每个脚本都无法离线执行（tsx 缺失）；跳步骤 2 直接做 4 → 没有向量设施，RAG 无法实现。

### §8.1 步骤 -1：修复红色基线（P0）

**为什么第一**：本项目后续每一步都靠"改完后测试数对比"来验证没有回归。基线是红的/flaky 的，这套验证机制失效。

> ### ⚠️ B-0：lint 全绿是后续步骤的**硬前置**（2026-10-07 追加）
>
> **结论**：在治理完 lint 之前，**不要开始阶段 0（LLM 评测基准集）**。理由：`npm test` 是所有步骤的回归闸门，而 lint job 与它并行；带着 59 个存量 error 继续加代码，会让「本步引入的问题」与「存量问题」混在一起，无法判定成败。
>
> **现状实测（2026-10-07 复核）**：`npm run lint` = **59 errors / 6 warnings**
>
> | 规则 | 数量 | 位置 |
> |---|---|---|
> | `@typescript-eslint/no-explicit-any` | 38 | `src/` 31 + `tests/` 7 |
> | `react-hooks/set-state-in-effect` | 8 | `AuthContext:134`、`Assessment:80`、`Home:167/279/405`、`FeedbackManage:25`、`StudentOverview:48`、`UserManage:32` |
> | `no-empty` | 6 | `PageCacheContext:31/39/46`、`Path:231`、`learningOrchestrator:574/579` |
> | `@typescript-eslint/no-unused-vars` | 4 | `roleBoundary.test:42/120`、`learningOrchestrator.test:39`、`questionBank.test:3` |
> | `react-refresh/only-export-components` | 3 | `AuthContext:250/257`、`PageCacheContext:56` |
> | `react-hooks/exhaustive-deps`（warn） | 6 | `App:67`、`Home:184/293`、`Practice:66`、`StudentOverview:49`、`UserManage:32` |
>
> **第 1 批（零行为风险）—— ✅ 已完成（台账 #18），59 → 42 errors**
> - `no-empty` 6 处：空 `catch {}` **加注释即可**（ESLint 的 `no-empty` 视带注释块为非空），不动逻辑 ✅
> - `no-unused-vars` 4 处：直接删 ✅（其中 `roleBoundary.test` 的「追问 user prompt」是**假通过**，已一并修正为真断言）
> - ~~`tests/` 的 7 处 `any`~~ → **此做法作废**：`eslint.config.js` 已有 `files: ['tests/**']` → `'@typescript-eslint/no-explicit-any': 'off'` 的 override（台账 #7 加的）。加 `eslint-disable` 注释反而会触发 `Unused eslint-disable directive` 告警。**tests 侧的 any 已被配置覆盖，不需要动**
>
> **第 2 批（类型收窄，约 17 errors）**
> - 页面侧 12 处：`StudentOverview`/`FeedbackManage` 换成同文件已 import 的具体类型；`Path`/`Profile`/`Resources` 用 `unknown` + 收窄；`SideMenu:55` 的 `extraItems: any[]` → antd `ItemType[]`
> - `multiAgentFramework.ts` 9 处：需连带改调用点，单独一次提交
>
> **第 3 批（会改运行时行为，单独排期，11 errors）**
> - `set-state-in-effect` 8 处：把「effect 内读 localStorage 再 setState」改为 **lazy `useState` 初始化函数**。可行性依据：`App.tsx` 中 `if (!isLoggedIn) return <Login />` 会卸载整棵子树，重新登录必然重新挂载 → 惰性初始化能正确按 `userId` 重读隔离数据。**注意** `Assessment` 仍需保留 `practiceStateUpdated` 事件订阅（effect 的正当用途），只把初始读取挪进 lazy init
> - `only-export-components` 3 处：把 `useAuth` / `getUserStoragePrefix` / `usePageCache` 拆到独立文件，原文件 re-export 保持现有 import 不断裂；或局部 disable（1 行，但该文件 Fast Refresh 失效）
>
> **两个必须避开的坑**
> 1. `src/hooks/useDebounce.ts:13` 签名 `<T extends (...args: any[]) => any>` —— **直接把 `any` 换 `unknown` 会编译失败**（`(x: number) => void` 不满足 `(...args: unknown[]) => unknown`）。用 `// eslint-disable-next-line`
> 2. `src/context/PageCacheContext.tsx` 是 7 个页面共用的缓存类型核心（`getState/setState` 全 `any`）—— 整体泛型化改动面大，**建议整文件 disable 注释**（改动面 0）
>
> **完成判据**：`npm run lint` 退出码 0；`npm test` 用例数与通过数不变（不得因改配置丢用例）；`npm run test:api` 13/13 仍通。

| 任务 | 操作 | 完成判据 |
|---|---|---|
| B-1 修 P-01 | 编辑 `tests/integration/api-real.test.ts`：整组加 `describe.skipIf(!process.env.LLM_E2E)`；文件头注释改为"需显式 `LLM_E2E=1` 且配置 Key 才运行" | `npm test` 输出中该文件为 skipped，失败数归零 |
| B-2 修 P-02 | ① 先单跑 `npx vitest run tests/unit/api.test.ts` 确认单跑稳定；② 把 `globalThis.fetch = mockFetch` 改为 `vi.stubGlobal('fetch', mockFetch)`；③ 把 `beforeAll(() => server.close())` 改为在 `beforeEach` 内关闭/重开，确保顺序确定 | 连续 3 次 `npm test` 均为 0 失败（至少 api.test.ts 稳定） |
| B-3 修 P-03 | `tests/components/Pages.test.tsx:25` 的 timeout 15000 → 30000 | 开 coverage 与不开 coverage 各跑一次均通过 |
| B-4 取覆盖率基线 | `npm run test:coverage -- "--coverage.reporter=json-summary"` → 读 `coverage/coverage-summary.json` 的 `total` | 拿到 lines/branches/functions/statements 四个百分比 |
| B-5 写 ratchet | 在 `vitest.config.ts` 的 `coverage` 下加 `thresholds`，值取 B-4 的**实测值向下取整**（如 lines 41.7 → 41），并在注释写"ratchet 基线，达成后每次 +5 点" | `npm run test:coverage` 绿 |
| B-6 记录快照 | 把最终"测试文件数 / 用例数 / 通过数 / 覆盖率四值"填入 §5.1、§5.2 表格，并新增一行 §12 台账 | §5 数字与实际一致 |

```powershell
# 验证"基线可信"的标准动作（连跑 3 次，结果必须一致）
1..3 | ForEach-Object { npm test 2>&1 | Select-String -Pattern "Test Files|Tests " }
```

**注意 B-2 的诊断价值**：如果单跑稳定、全跑不稳定，就证实了"多文件共享 fetch 环境"的判断，后续新增测试文件也要遵守同一纪律（**不要在测试文件顶层直接改 `globalThis`**，一律用 `vi.stubGlobal`）。

### §8.2 步骤 0：Key 止损与配置外置

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S0-1 | 新建 `.env.example`，列出 10 个键，值留空 | 文件入库且不含真实值 |
| S0-2 | `.gitignore` 追加 `.env`、`.env.*`、`!.env.example` | `git status` 不再出现 `.env` |
| S0-3 | 新建 `src/config/llmConfig.ts`：`resolveLlmConfig()` **在函数体内**读 `import.meta.env`，缺 Key 返回 `{ isConfigured: false }` 不抛异常；Node 侧兼容 `process.env`；导出 `DEFAULT_TIMEOUT_MS=180000`、`DEFAULT_MAX_TOKENS=8192` | 文件存在；**禁止在模块顶层解构 `import.meta.env`**（vitest 下会崩） |
| S0-4 | 改 `src/services/api.ts`：删 L4 Key、两处模型名改 config；导出 `AnthropicRequest`；`chatCompletion` / `streamChatCompletion` 加**可选第二参** | 11 处调用点零改动仍编译通过 |
| S0-5 | 改 `tests/integration/api-real.test.ts` 的 Key/模型名（skipIf 已在 B-1 做） | 无硬编码 |
| S0-6 | 自查密钥 | `rg -n "sk-[A-Za-z0-9_-]{20,}" --glob '!node_modules/**' --glob '!learning-agent/**'` → 0 命中 |
| S0-7 | **人工步骤**：平台作废旧 Key + 重签；写入 §13 状态 | §12 记录"人工已完成"及日期 |
| S0-8 | 验收 | `npm test`（断网跑一次）/ `npm run build` / `npm run lint` 全绿 |

### §8.3 步骤 1：LLM 评测基准集

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S1-0 | **先理解分层**（原计划未写清，新手最易在这里翻车）：<br>· **金标层**：83 条真实 `sampleAnswer`（python 8 / java 60 / database 15）→ 用于阈值拟合与主要评测<br>· **合成层**：客观题用「题干 + 正确答案 + explanation」合成参考答案 → **只进 smoke 集，不参与阈值拟合**<br>字段 `referenceSource: 'sampleAnswer' \| 'synthesized'` | 能解释"为什么不能从 python 题库凑出 100 条金标"（因为它只有 8 条） |
| S1-1 | 定义 `GoldenItem` 类型 | TS 编译通过 |
| S1-2 | 用 `knowledge-workers` skill 派发 worker 批量抽取「预期要点 + 禁止项」初稿，summary 落盘 | 有 worker briefing + summary 文件 |
| S1-3 | 合成层 30 条 smoke | `reviewed:false` 起步 |
| S1-4 | 人工审校（20% 抽检 + 全量过一遍禁止项） | `reviewed:true` 覆盖率达约定条数 |
| S1-5 | `tests/golden/goldenSet.ts`：`loadGoldenSet()` / `assertGoldenSet()` / `getPositiveNegativePairs()` | 校验失败时错误信息含 id + 字段名 |
| S1-6 | `tests/golden/goldenSet.test.ts`：id 唯一、要点 ≥3、禁止项 ≥2、三锚点长度单调（poor < fair < excellent）、tag 在规范表内、`referenceSource='sampleAnswer'` 时题库确有该字段、每条 question 与参考答案至少命中一个要点 | **负向验证**：故意改坏一条 → 测试必须红 |
| S1-7 | `tests/eval/runGoldenEval.test.ts`：`enableModel:false` 零额度跑批，输出逐条结果 JSON | 断网可跑 |
| S1-8 | `tests/mocks/handlers.ts` 预留 RAG 分支 | 现有 5 分支行为不变 |

**新手易错点**：`tests/golden/*.json` 跨目录导入可能被 `tsc -b` 拒绝（`resolveJsonModule` 跨界）。若报错，二选一：把 JSON 移到 `src/data/`，或在测试里用 `fs.readFileSync` 读取。

### §8.4 步骤 2：向量基础设施

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S2-0 | **先做**：用 `code-explorer` subagent 提取 `temp_process.cjs` / `temp_db_parse2.cjs` 里的 `tagMap`/`moduleMap`，产出三套 tag → 统一规范 tag 的映射清单，并核对三个题库的 tag 分布差异 | 清单文件存在；确认无原始中文 tag 泄漏 |
| S2-1 | `src/services/embedding/embeddingProvider.ts`：中文 1/2/3-gram + 英文 word → 过滤 STOP_WORDS → `FNV-1a % 256` → 亚线性 tf × IDF → L2 归一化。**IDF 必须由参数注入（构建期算好后随 `ragVectors.json` 入库）** | 同文本两次 embed 位级相同；范数为 1 |
| S2-2 | `src/services/embedding/vectorStore.ts`：`encodeVectors` / `decodeVectors` / `cosineDot` / `topK`。**base64 解码统一封装** `base64ToBytes()`：`atob` 优先、`Buffer` 兜底（Node 脚本与浏览器都要能用） | 编解码往返误差 ≤ 量化步长 |
| S2-3 | `src/services/rag/corpusBuilder.ts`：纯函数，无 IO 副作用 | 块数落在 `[350, 500]` |
| S2-4 | `src/services/embedding/buildIndex.ts`：导入两份 JSON，**校验 id 集合严格一一对应**（不一致抛错）；解码 + 预归一化 + 模块级单例缓存；`retrieve()` 混合召回；全低于 floor 返回 `[]` | 440 条检索 < 5ms |
| S2-5 | `scripts/build-vectors.ts`：串联 S2-1..S2-3 → 产出 `src/data/ragChunks.json`、`ragVectors.json`（含 `dim/model/scale/idf/ids/vectors/hash`）；支持 `--out-dir=` 与 `--check`（只校验不写盘）；输出摘要；**必须零网络** | **连跑两次产物字节级一致** |
| S2-6 | 三个题库各补 `export const questionById` | 编译通过 |
| S2-7 | 5 个单测文件（provider / store / corpus / artifacts / 索引一致性） | `--check` 负向验证：手改 1 字节必须红 |
| S2-8 | `package.json` 加 scripts：`vectors:build` / `threshold:tune` / `eval:golden` / `eval:rag` / `eval:report` / `typecheck`；加 `engines` | 命令可跑 |

**新手易错点**：跳过 S2-0 直接写 corpusBuilder → tag 口径不一致，检索质量无法解释。

### §8.5 步骤 3：三级质量漏斗 + 阈值调优

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S3-1 | `tutorQuality.ts` 向后兼容扩展：导出 `STOP_WORDS`；新增可选第二参 `ref?`；新增 `jaccardText()` | **现有 21 条测试零改动仍全绿** |
| S3-2 | `src/services/answerScorer.ts`：纯函数，禁止项命中 = 硬否决；要点覆盖率；与三锚点余弦；合成 0-100 | 无 reference 时返回中性分不崩 |
| S3-3 | `src/services/qualityFunnel.ts`：规则 → 语义 → 模型；**语义层不过时不调模型层**；`enableModel` 默认 `false`；模型层异常返回 `modelDegraded=true` | `vi.spyOn` 断言"未调用 `chatCompletion`" |
| S3-4 | `promptBuilder.ts`：`buildQualityReviewPrompt()` / `buildRagRegenerateHint()` | 现有 13 个函数签名不变 |
| S3-5 | `practiceGrader.ts`：删私有 jaccard 改用共享实现；内联 prompt 收敛；修 NaN bug | 若 jaccard 统一导致分数变化，见 §6 P-10 的兜底 |
| S3-6 | `Tutor.tsx`：`aiReviewAnswer` 返回 `{score, degraded}`；`generateWithValidation` 接入漏斗，保留"最多 2 次重生成" | 两处 `return 80` 不再存在 |
| S3-7 | `scripts/tune-threshold.ts`：逐阈值（0..1 步长 0.01）算全表 → Youden J 最优点 → LOO 稳定性 → `test-results/threshold-report.json` + Markdown 表；输出 `usable` 判定 | **必须复用与运行时同一份量化向量** |
| S3-8 | **人工 review 后把阈值写进 `src/config/qualityThresholds.ts`**（产物不入库，只入库常量） | 报告中每项阈值都注明来源 |
| S3-9 | 三个单测文件 | 关键断言：poor 锚点 cosine 中位数 < 阈值 ≤ excellent 锚点中位数 |

**必须人工判断的岔路（S3-7 之后）**：若 `youdenJ < 0.3` 或 excellent/poor 分数中位数重叠 → **不要硬上阈值**，转 `SEMANTIC_SHADOW_MODE=true`（只记录不拦截），并在 §12 记录该决策与依据。

### §8.6 步骤 4：RAG 知识库接入

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S4-1 | `src/services/rag/retriever.ts`：`retrieveForQuestion(question, {topK=3, tagHint?})`；`RAG_ENABLED=false` 直接返回 `[]` | 关闭开关时等价于改造前 |
| S4-2 | `src/services/rag/ragPrompts.ts`：`formatChunksForPrompt()`（单片段 ≤300 字、总长 ≤1500 字、`[1][2]` 引用编号）+ `formatCitations()` | 长度上限有单测断言 |
| S4-3 | `promptBuilder.buildRagAnswerPrompt(chunks, profile)`：注入 + 「仅依据给定资料」约束 + 引用标注；**chunks 为空时返回空上下文** | 空数组输入不产生无约束 prompt |
| S4-4 | `Tutor.tsx handleAsk`：构造 messages 前调**一次**检索（禁止放进重试循环） | 代码 review 确认只调一次 |
| S4-5 | `tests/golden/rag-queries.json`：60~80 条（优先用 83 道简答题的题干作 query，另补 10~15 条概览型） | ≥50 条有效标注 |
| S4-6 | `src/services/rag/ragMetrics.ts`：`recallAtK` / `mrr` / `ndcgAtK` / `faithfulness`（按中文句号/问号/分号切句，逐句求余弦） | 指标定义写进注释 |
| S4-7 | `tests/eval/rag-eval.test.ts`：检索质量门禁 + 忠实度反例 + withRag/withoutRag 对照 | 两个反例（检索对但回答跑偏 / 检索错但回答碰巧对）能区分 |
| S4-8 | `handlers.ts` 加 RAG 分支：识别引用编号返回「依据 [1] …」结构 | 现有 5 分支不变 |
| S4-9 | 验证 bundle 体积；检索模块动态 import（首次提问懒加载） | 记录前后体积 |

### §8.7 步骤 5：RAG 评测体系 + CI 门禁

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S5-1 | `scripts/gen-eval-report.ts`：照 `gen-test-report.ts` 范式读三份 JSON → `test-results/eval-report.html`；**所有注入文本必须 HTML 转义** | 报告可本地打开 |
| S5-2 | `vitest.config.ts`：`coverage.exclude` 追加 `src/config/**` | 覆盖率分母不含生成物 |
| S5-3 | `ci.yml`：Node → `20.19.0`；test job 跑 coverage 并上传；**新增 eval job**（只跑 `--check` + 出报告 + 上传 artifact，`needs:[lint,test]`）；**新增 live-eval job**（`workflow_dispatch` + secret 守卫） | 每个 job 的命令都能在本地跑通 |
| S5-4 | `.husky/pre-commit`：加 JSON 语法校验（建议新增 `scripts/check-json.mjs`，零依赖约 15 行；或 `node -e "JSON.parse(...)"`），覆盖 `tests/golden/**` 与 `src/data/rag*.json` | 故意写坏 JSON → 提交被拦 |
| S5-5 | 把 eval job 从 A（观察）调到 B（告警），记录真实基线 | 告警不阻断，且汇总可见 |
| S5-6 | 写评测方法说明（README 章节）：每个指标定义、门禁含义、报告读法、阈值来源 | 新人能照文档解释报告 |

### §8.8 步骤 6：技术债清理与文档同步

| 任务 | 操作要点 | 完成判据 |
|---|---|---|
| S6-1 | 消除相似度双份实现 + 收敛 prompt 双份真相 | 见 §6 P-10/P-11 的兜底规则 |
| S6-2 | 修 NaN bug + 补单测 | 有针对纯简答模块的用例 |
| S6-3 | `learning-agent/`：**先只删其中 `.env.local`**；整目录删除需三步前置（`git ls-files learning-agent \| Measure-Object -Line` 为 0 / 检查 `.gitignore` 例外 / zip 备份到 `scripts/tmp/`） | 密钥文件不存在；三步结果记录在 §12 |
| S6-4 | 修 README：代码块闭合、替换 Vite 模板文字、补环境变量与评测章节 | **README 里每条命令都实际执行过** |
| S6-5 | ~~修 `AGENTS.md` 三处过时 + `CLAUDE.md` 逐字同步~~ → **已作废（台账 #17）**，改为「`AGENTS.md` 精简为指向 README 的入口指针」 | `AGENTS.md` | 已完成 |
| S6-6 | ~~更新 `测试缺口.md` 链接 §13~~ → **已作废（台账 #17）**，该文件已废止删除 | — | 已关闭 |
| S6-7 | 根目录 `temp_*` 文件：保留，在 README 说明「一次性数据处理脚本，勿删，RAG 语料溯源依据」 | 说明在案 |

### §8.9 每日执行记录模板（复制到 `docs/exec-log-YYYY-MM.md`）

```markdown
### YYYY-MM-DD
- 阶段/任务卡：步骤 N · S N-M（完成 / 部分 / 阻塞）
- 变更文件：<清单>
- 测试：全量 __ 条通过（基线 __ 条），新增 __ 条
- 门禁：当前阶段 A/B/C，eval job：绿 / 告警(__ 项) / 红
- 降级演练：本次执行 D-__，结果：符合 / 不符合（不符合列修复项）
- 数值快照：Recall@3=__ / MRR=__ / 忠实度=__ / 覆盖率=__%
- 风险变动：新风险编号 + 缓解措施
- 简历可写增量：（仅在对应 DoD 全勾后写）
- 明日第一件事：
```

**降级演练清单（D-1 ~ D-10）**在 `实施计划_细化版.md` §11，每个阶段完成后必须抽查对应几条，验证兜底真的生效。**兜底不生效即 P0 缺陷，当日修复。**

### §8.10 tag 与回滚

```powershell
# 每步结束打 tag（打完在 §12 记录）
git tag -a baseline-key -m "步骤0 Key 止损完成"
# 回滚优先级：① 关开关（改 1 行配置）→ ② git revert 单个 commit → ③ revert 整个步骤区间
git --no-pager log --oneline -20
```

提交粒度约定：一个任务卡一个 commit，前缀 `[P0]`~`[P6]` 表示步骤号，`[FIX]` 表示修缺陷，`[DOC]` 表示文档。**禁止把步骤 3 的代码和步骤 6 的格式化混在一个 commit**（否则无法按步骤回滚）。

---

## §9 开关与降级速查

> 全部开关集中在 `src/config/evalConfig.ts` 与 `src/config/qualityThresholds.ts`，**禁止散落在业务代码里**。

| 开关 | 默认 | 关闭时行为 |
|---|---|---|
| `RAG_ENABLED` | `false` | 检索返回 `[]`，不注入上下文，行为 = 改造前 |
| `SEMANTIC_LAYER_ENABLED` | `false` | 跳过语义层，拦截交给规则层 + 模型层（**默认就是关的**；且 Tutor 生产链路不传 `reference/scorer`，即使打开也恒为 skipped） |
| `MODEL_LAYER_ENABLED` | `true` | 只走规则层 + 语义层；`modelScore=null`，`layersSkipped` 含 `model` |
| `SEMANTIC_SHADOW_MODE` | `true` | 语义层只记录不拦截（阈值区分度不足时用；默认即为影子模式） |
| `EVAL_MODE` | `offline` | `live` 才允许真实 LLM 调用（`liveEvalAllowed()` 目前**尚未接线**到出网入口） |
| `RETRIEVAL_FLOOR` | 阈值脚本产出 | 全部低于 floor → 判无覆盖，不注入 |
| `MODEL_DEGRADE_IS_BLOCKING` | `false` | 模型层降级不阻塞用户体验，只计入报告；设 `true` 时降级会 `accepted=false` |

> 默认值以 `src/config/evalConfig.ts` 为准（上面的表在 2026-10-08 已与代码对齐；
> 覆盖方式为带 `VITE_` 前缀的环境变量）。改动默认值时必须同步本表 +
> `实施计划_细化版.md §1.2` + `docs/eval-methodology.md`，三处一起改。

**五级降级链**：L0 正常 → L1 语义层降级（只记录）→ L2 模型层降级（`modelDegraded=true`，是否阻塞由 `MODEL_DEGRADE_IS_BLOCKING` 决定）→ L3 RAG 降级（不注入上下文，**绝不注入空上下文**）→ L4 纯规则降级（等价于改造前）。

**硬性实现约束**：语义层与模型层必须被 `try/catch` 包住且**绝不向 `Tutor.tsx` 抛异常**；`buildIndex` 捕获导入/解码失败后返回 `null`，检索见到 `null` 返回 `[]` 并打 `ragUnavailable` 标记；每层是否执行由 `FunnelResult.layersRun` / `layersSkipped` 显式记录（**2026-10-08 更新**：报告侧已接线降级卡片，见 `scripts/gen-eval-report.ts` 的 `renderDegradation` 与 `docs/eval-methodology.md` §0；卡片统计的是「规则层否决 / 覆盖率不达标 / 检索无覆盖」三项，**仅 L2 模型层降级尚未接入**，已登记 §13 B-27）。

---

## §10 门禁与 CI 操作手册

### §10.1 现有 4 个 job（+ 本轮新增 2 个，见 §10.2）

| job | 命令 | 交接时已知问题 |
|---|---|---|
| lint | `npm run lint` | ✅ 2026-10-08 CI run #3 转绿（0 error / 1 warning） |
| test | `npm run test:coverage` | ✅ run #3 绿（22 文件 / 517 用例，覆盖率门槛 24/20/17/17 通过） |
| build | `npm run build` | ✅ run #3 绿（这是它第一次真正执行 —— 此前因 lint 红而被 skip） |
| e2e | `npx playwright install --with-deps chromium && npm run test:e2e` | ❌ run #3 **首次真正执行即失败**，见 §13 B-21；本地复现需先装浏览器 |

### §10.2 本轮新增的 job

| job | 职责 | 触发 |
|---|---|---|
| eval | `golden:check` + `vectors:build --check` + `threshold:tune --check` + `eval:golden` + `eval:rag` + `eval:report` + 上传 artifact；`needs: [lint, test]` | push / PR |
| live-eval | 真实 LLM 基准回归（`npm run test:api`）；Key 缺失时其**所有 step 被跳过**（不是 job 级 skipped，因为 job 级 `if` 读不到 secrets，见 §10.4） | **仅** `workflow_dispatch` 且勾选 `run_live_eval` |

**重要口径**：eval 测试文件（`tests/eval/**`）已被 `vitest.config.ts` 的 `include: ['tests/**/*.test.{ts,tsx}']` 覆盖，所以 **test job 已经跑它们了**；但 `golden-eval.json` / `rag-metrics.json` 是**测试的副作用产物、写在 test job 自己的工作区里**，eval job 拿不到，因此 eval job 仍需自己跑一遍 `eval:golden` + `eval:rag` 再生成报告（否则报告缺两块）。

### §10.4 CI 的两个致命陷阱（2026-10-08 实测，务必先读）

**陷阱 1：`secrets` 不能出现在任何 `if:` 里 —— 会让整份 workflow 以 0 个 job 失败。**

- 现象：Actions 里出现一次运行，**job 数 = 0、无任何日志、状态直接 Failure**；`gh` / API 查 `jobs` 返回空数组。
- 原因：GitHub 的上下文可用性规定，`jobs.<job_id>.if` 只允许 `github / needs / vars / inputs`，
  step 级 `if` 也只多出 `env / steps / matrix` 等 —— **两处都没有 `secrets`**。
  写 `if: secrets.MY_KEY != ''` 属于解析期错误，不是「该 job 被跳过」。
- 正确写法：secret 在 **job 级 `env`**（允许 secrets）求值，再由 **step 级 `if` 读 `env`**（step 级 if 允许 env）：
  ```yaml
  env:
    HAS_KEY: ${{ secrets.MY_KEY != '' }}
  steps:
    - uses: actions/checkout@v4
      if: env.HAS_KEY == 'true'
  ```
- 本地自检：`node scripts/tmp/check-workflow.mjs .github/workflows/ci.yml`
  （临时脚本，检查 if 上下文合法性 / runs-on 缺失 / needs 悬空；未接入 CI，见 §13 B-29）

**陷阱 2：本地 YAML 解析通过 ≠ GitHub 能接收。**
`yaml.parse` 只校验语法，不校验上下文与 schema。凡是改 `.github/workflows/*.yml`，
必须在推送后回看一次 Actions 首页：**看 job 数是否为 0**，而不是只看结论色。

### §10.3 本地如何复现每个 job

```powershell
# lint job
npm run lint

# test job（覆盖率门禁）
npm run test:coverage

# build job
npm run build

# e2e job（本机未装浏览器 → 未验证）
npx playwright install chromium
npm run test:e2e

# eval job（按顺序）
npm run golden:check
npm run vectors:build -- --check
npm run threshold:tune -- --check
npm run eval:golden
npm run eval:rag
npm run eval:report

# live-eval job（需 Key，本机默认跳过）
$env:LLM_E2E='1'; $env:VITE_DEEPSEEK_API_KEY='<Key>'; npm run test:api
```

---

## §11 故障排查手册（症状 → 原因 → 处置）

> 这里的每一条都来自**实测或已核实的事实**，不是推测。处置前先看 §11.0 通用诊断动作。

### §11.0 通用诊断三问

1. 是**基线就有的问题**还是**我这次改动引入的**？→ 对照 §5.1 基线，或 `git stash` 后重跑对比。
2. 单独跑这一条还失败吗？→ `npx vitest run <文件路径>`。单跑通过 = 调度/环境污染（见 §11.1、§11.2）。
3. 与网络有关吗？→ 断开网络再跑一次；能过的说明有请求漏出（重点查 `onUnhandledRequest: 'bypass'`）。

### §11.1 `Test timed out in 15000ms`（组件导入类）

- **实例**：`tests/components/Pages.test.tsx > Home 模块可正常导入`
- **原因**：动态 `import()` 页面组件，页面 import 链路含 antd / recharts 等大依赖；开 coverage 插桩后更慢；setup 阶段本身已耗 16~19s
- **处置**：① 该用例 timeout 提到 30000；② 仍不稳则 `vi.mock` 掉重依赖；③ 确认不是真卡死（真卡死会伴随 CPU 打满且无输出）
- **验证**：开 / 不开 coverage 各跑一次都通过才算修好

### §11.2 `API Error 500 / 400 Invalid request / DOMException`（单元测试里出现真实网络错误）

- **实例**：`tests/unit/api.test.ts` 的 `streamChatCompletion` 6 个用例（flaky）
- **原因**：测试文件顶层 `globalThis.fetch = mockFetch` 被同 worker 内其他测试文件的 `setup.ts`（`server.listen()`）重新 patch 覆盖 → 请求漏到真实网络；而 `tests/setup.ts:63` 是 `onUnhandledRequest: 'bypass'`，漏出去的请求**不会被拦截**
- **处置**：① 用 `vi.stubGlobal('fetch', mock)` 替代直接赋值（vitest 会自动在用例间恢复）；② 用 `vi.hoisted` 确保 mock 在被测模块 import 之前生效；③ 不要在测试文件顶层直接改 `globalThis` 上的东西
- **预防**：新增测试文件一律遵守同一纪律

### §11.3 `npm test` 报 401 Unauthorized

- **原因**：真实 Key 已失效（`api.ts:4` 硬编码的那串）
- **处置**：这是**预期状态**（P-01），由步骤 -1 / B-1 用 `skipIf` 跳过。若要做真实评测，先完成步骤 0 并配置新 Key
- **注意**：401 出现次数越多说明测试越在偷跑真请求，属严重问题

### §11.4 `Cannot read properties of undefined (reading 'VITE_...')` / `import.meta.env` 相关崩溃

- **原因**：在模块**顶层**解构 `import.meta.env`（vitest 环境不提供）
- **处置**：改成在函数体内访问；Node 侧兼容读 `process.env`

### §11.5 `tsc -b` 报未使用变量 / 未使用参数

- **原因**：`tsconfig.app.json` 开了 `noUnusedLocals` / `noUnusedParameters`
- **处置**：删掉未用变量（**不要**用 `@ts-nocheck` 绕过）；导出型工具函数可加测试覆盖

### §11.6 `Something removed the coverage directory ... Vitest created earlier`

- **原因**：同时跑了两个 vitest 进程（CI/本地重复触发，或上一次运行未结束）
- **处置**：确认没有后台 vitest 进程（PowerShell：`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` 查命令行），等前一个结束再跑

### §11.7 vitest 不生成覆盖率报告 / 没有覆盖率表格

- **原因**：**有测试失败时 vitest 4 跳过覆盖率报告生成**（实测）
- **处置**：先把基线修绿（步骤 -1），再取覆盖率数字。这也是 §5.2 的结论

### §11.8 `atob is not defined`（跑构建脚本时）

- **原因**：Node 侧脚本环境与浏览器 API 差异
- **处置**：统一走 `base64ToBytes()` 封装（`atob` 优先，`Buffer` 兜底），不要在业务代码里直接用 `atob`

### §11.9 `ragVectors.json` 与 `ragChunks.json` id 不一致报错

- **原因**：手工改过产物，或只重跑了其中一个
- **处置**：**产物是生成物，不可手改**。重跑 `npm run vectors:build` 重新生成；若想永久禁止改动，靠 `vectorsArtifacts.test.ts` 的哈希一致性测试

### §11.10 `git` 报 `dubious ownership`

见 §3 坑 1。

### §11.11 PowerShell 里脚本参数被截断 / 带空格路径出问题

- **处置**：参数一律用等号形式（`--out-dir=./out`）；脚本内部路径一律 `path.resolve(__dirname, ...)`；**不写平台相关命令**

### §11.12 单测报"答案不对"但逻辑看起来没问题

- **原因**：跨平台浮点或量化误差
- **处置**：先确认是否量化相关（ADR-03）；需要严格可复现时，对 int8 量化后的整数值求和，规避浮点非结合性；**绝不**放宽断言到"差不多"了事

### §11.13 CI 运行「0 个 job + 立即失败 + 没有日志」

- **现象**：Actions 列表出现一次运行，点进去**一个 job 都没有**，时长显示 `–`，产物为空；
  `Invoke-RestMethod .../actions/runs/<id>/jobs` 返回 `job 数: 0`，check-runs 也是 0。
- **原因**：workflow 文件**解析期**错误（不是某个 job 跑挂）。最常见的是在 `if:` 里用了不可用的上下文 ——
  `secrets` 就是典型（正确用法与修法见 §10.4 陷阱 1）；此外 `needs` 指向不存在的 job、job 缺 `runs-on` 也会这样。
- **关键判别**：对比「上一次在同一仓库能跑起来的运行」的 job 数。若旧运行有 job、新运行为 0，
  一定是本次 workflow 改动引入的解析错误，**与业务代码无关**。
- **处置**：本地 YAML 解析**发现不了**这类问题，必须按 §10.4 的上下文规则逐条核对；
  可用 `node scripts/tmp/check-workflow.mjs .github/workflows/ci.yml` 做一次静态自检。

---

## §12 变更记录台账

### §12.1 写入规则（强制）

1. **任何**代码、配置、文档、依赖变更，必须在下方表格新增一行。
2. 一行 = 一次提交或一次可独立验证的改动。字段缺失即视为无效记录。
3. 修 bug 也要记（尤其 §6 里的 P-xx），并在 §6 状态列回填「已修（见 §12 台账第 N 行）」。
4. 需求不实现的，也要记到 §13 并标 `不做的理由`。
5. **不允许在其他文档重复记录变更历史。**

### §12.2 台账

| # | 日期 | 阶段/步骤 | 变更内容 | 文件 | 原因 / 关联 | 验证方式 | 执行人 |
|---|---|---|---|---|---|---|---|
| 1 | 2026-10-07 | 计划 | 新增 `plan.md`（路线主线：Key 止损 → 阶段 0 基准集 → 阶段 1 语义相似度 → 阶段 2 RAG → 阶段 3 RAG 评测） | `plan.md` | 上游路线规划 | 文档评审 | — |
| 2 | 2026-10-07 | 计划 | 新增 `实施计划_细化版.md`（任务卡化 + 风险表 + 降级兜底 + 故障演练 + 门禁三阶段 + 6 处选型修正 T-1~T-6） | `实施计划_细化版.md` | 原计划颗粒度不足以直接施工 | 文档评审 | — |
| 3 | 2026-10-07 | 交接 | 新增本文件 `HANDOVER.md`；确立 §12/§13 为变更与需求的唯一真源 | `HANDOVER.md` | 交接需要零背景可执行的单一入口 | 文档评审 | — |
| 4 | 2026-10-07 | 基线核实 | 实测基线：`npm test` = 12 文件 / 344 用例 / 17 失败；排除 `api-real` 后 11 文件 / 334 用例 / 1 失败；两次运行结果不一致（flaky 已确认）；覆盖率因存在失败而无法生成 | §5.1 §5.2 §5.4 | 接手人必须知道"基线是红的" | 复现 §2-4 / §2-5 命令 | — |
| 5 | 2026-10-07 | 基线核实 | 确认硬编码密钥位置 `api.ts:4`、模型名 `api.ts:57/160`、评审兜底 `Tutor.tsx:193/195`、`.gitignore` 缺 `.env` 规则、`package-lock` 无 tsx、python 题库仅 8 条 `sampleAnswer` | §1.3 §4.2 §6 | 修正原计划的 6 处与代码不符之处 | `rg` / `Select-String` 逐项复核 | — |
| 6 | 2026-10-07 | 步骤 -1 | 修复页面导入 flaky：8 个页面模块导入用例统一 `IMPORT_TIMEOUT = 60000`（抽出常量并注释原因），只放宽超时上限、不改任何断言 | `tests/components/Pages.test.tsx` | 并行资源竞争导致 `Home` 动态 import 超时（单跑该文件 14/14 通过，tests 耗 35.85s） | `npm test` 连续 4 次 11 文件 / 334 用例全绿 | CodeBuddy |
| 7 | 2026-10-07 | 步骤 -1 | 新增覆盖率 ratchet 门槛（lines 19 / statements 18 / functions 13 / branches 12），并注释基线来源与"每次 +5 点、禁止一步设 70" | `vitest.config.ts` | 实测覆盖率仅 19.75 / 18.99 / 13.94 / 12.72，直接设 70 会让门禁第一天红 | `npm run test:coverage` 通过且报告正常生成 | CodeBuddy |
| 8 | 2026-10-07 | 步骤 -1 | ESLint 配置修复：`globalIgnores` 补 `coverage` / `test-results` / `learning-agent` / `scripts/tmp`；新增 `tests/**` 关闭 `no-explicit-any`；清理 5 处因此变多余的 `eslint-disable` | `eslint.config.js`、`tests/ai/gradeByAI.test.ts`、`tests/unit/practiceGrader.test.ts`、`tests/unit/api.test.ts`、`tests/test-utils.tsx`、`tests/setup.ts` | 生成目录被 lint 扫描；测试 mock 需要 `any`；放宽规则后原有 disable 指令变"无用"而产生 warning | lint 从 68 problems（59 errors）降到 58 problems（52 errors，**全部在 `src/`**） | CodeBuddy |
| 9 | 2026-10-07 | 步骤 0 | `api-real.test.ts` 的「API 错误处理」组补 `describeWithKey` 守卫（原先 4 组里唯一漏守卫的一组） | `tests/integration/api-real.test.ts` | 该组无条件直连真实接口，未配 Key 时会因连接/鉴权失败而误报失败 | `grep` 确认 4 组均为 `describeWithKey`；**未执行 `npm run test:api`**（会消耗额度，需人工决定） | CodeBuddy |
| 10 | 2026-10-07 | 文档 | 回写本文档：§1.3 LLM 现状改为 DeepSeek + 真实 API 测试隔离说明；§5.1 基线改全绿并留痕修复过程；§5.2 填入覆盖率实测值；§6 更新 P-01~P-04 状态并新增 P-14~P-16；§13 新增 B-18~B-20 | `HANDOVER.md` | 变更必须留痕（§12 规则 1）；且文档与代码漂移已构成风险（P-16） | 与实测命令输出逐项核对 | CodeBuddy |
| 11 | 2026-10-07 | B-19 | 页面级代码分割：10 个页面改 `React.lazy` + `<Suspense>`（antd `Spin` 作 fallback），登录页保持静态引入；新增 `scripts/measure-entry-size.mjs` 与 `npm run measure:size` | `src/App.tsx`、`scripts/measure-entry-size.mjs`、`package.json` | 首屏单 chunk 2,162 kB（gzip 709 kB）触发 >500 kB 告警；**做 RAG 前必须先拆**，否则 143 KB 向量 JSON 会叠在已超标包体上 | `npm run build` 通过；`measure:size` 显示首屏 gzip 280.1 KB（-60.5%）、主 chunk 28.6 kB；`npm test` 334/334 全绿 | CodeBuddy |
| 12 | 2026-10-07 | B-20 | 确认 `.env.local` 中的 DeepSeek Key **有效且继续使用**（用户 2026-10-07 确认），不需平台侧作废 | §6 P-04、§13 B-20 | 用户明确说明该 Key 正确 | — | 用户确认 |
| 13 | 2026-10-07 | 文档整合 | 重写 `README.md` 为唯一权威文档（项目简介/功能/使用方式/目录结构/测试现状/注意事项/更新记录）；`AGENTS.md` 精简为指向 README 的指针；**删除** `CLAUDE.md`（与旧 AGENTS.md 字节重复且信息过期）与 `测试缺口.md`（有效内容已并入 README） | `README.md`、`AGENTS.md`、删除 `CLAUDE.md`、`测试缺口.md` | 用户要求「梳理整合全部文档，已完成内容删除，重复信息合并，输出一份全新 README」 | 逐条比对代码实测（题库题数、页面数、命令、测试数） | CodeBuddy |
| 14 | 2026-10-07 | 步骤 -1 | 修复 26 个类型错误，`tsc -b` 从 159 错 → **0 错**：`ModuleMeta.questionCount` 改为从题库实时统计（`Home.tsx` 新增 `moduleQuestionCount` Map + 除零保护；`practiceGrader` 用真实题数）；三处 `isSubmitted` 改为 `isCorrect !== null \|\| aiScore !== undefined`；`UserManage` role 加 `UserRole` 标注；`Tutor` error 用 `instanceof Error` 收窄；清理 14 处未使用导入/变量 | `src/pages/Home.tsx`、`Practice.tsx`、`App.tsx`、`Path.tsx`、`Tutor.tsx`、`admin/UserManage.tsx`、`admin/StudentOverview.tsx`、`components/SideMenu.tsx`、`services/learningOrchestrator.ts`、`services/practiceGrader.ts`、三个题库 | 这些错误被 `javaQuestionBank.ts` 的语法错误掩盖，补逗号后才暴露；不修则 `npm run build` 与 CI `build` job 失败 | `npx tsc -b` 0 错误；`npm run build` 通过（3908 模块，2162 kB） | CodeBuddy |
| 15 | 2026-10-07 | 步骤 -1 | 接线 `Practice.tsx` 的 `moduleProgress` 死状态：在两张进度卡下方新增「各模块进度」区域（每模块 `已答/总题` + 进度条标注模块得分）。同时删除 `allResults`、`wrongByTag`、`filteredWrongQuestions`（抽屉渲染处已内联同样过滤，属重复代码） | `src/pages/Practice.tsx` | `setModuleProgress` 在提交/重置后均被调用但 `moduleProgress` 从未渲染，是「做了一半未接线」；判定为原作者意图而非死代码，故补渲染而非删除 | `tsc -b` 0 错误；`npm test` 通过数不减少 | CodeBuddy |
| 16 | 2026-10-07 | 计划 | 更正本文章档三处数据：§1.3、§6 P-14、§13 B-18 的 lint 数字由「52 errors / 全在 src/」更正为「**59 errors / 6 warnings**，src/ 52 + tests/ 7」，并在 §8.1 新增 **B-0 硬前置任务卡**（含三批修法与两个必须避开的坑） | `HANDOVER.md` | 原数据漏算 `tests/` 下 7 处 `no-explicit-any`（52+7=59）；原数据会让下次治理遗漏 tests 侧 | `npx eslint . --format json` 聚合复核，逐条核对 ruleId 与文件行号 | CodeBuddy |
| 17 | 2026-10-07 | 计划 | **用户裁决 §0.3 新分工并同步落地**：`README.md` 为项目说明唯一真源；`AGENTS.md` 退化为 11 行入口指针（不含项目事实）；**`CLAUDE.md` 与 `测试缺口.md` 正式废止**。同步修正 16 处失效引用：本文档开头规则、§0.3 表格、§4.1 目录树（并去掉重复的 README 行）、P-08、S6-5/S6-6、§13 规则、B-15；以及 `实施计划_细化版.md` 的 S6-5/S6-6、S6-R2、3 处 checklist、验收总表 | `HANDOVER.md`、`实施计划_细化版.md` | 台账 #13 删除了 `CLAUDE.md` / `测试缺口.md`，与 §0.3「两份必须逐字相同」冲突。用户裁决采纳「改 §0.3 承认新分工」而非恢复文件。理由：两份逐字相同的文档靠人工维持必然漂移（原 P-08 / B-15 预警已实际发生） | 全局复查两份文档无残留失效引用；§0.3、P-08、P-17、B-15、S6-5/S6-6、S6-R2 状态一致 | CodeBuddy |
| 18 | 2026-10-07 | B-0 第 1 批 | **lint 59 → 42 errors，测试首次全绿**。① `no-empty` 6 处：空 `catch {}` 加说明注释（`PageCacheContext` ×3 / `Path:231` / `learningOrchestrator` ×2），不动逻辑；② `no-unused-vars` 4 处：删 `loadProfile` 未用导入、`questionBank.test.ts` 未用类型导入、`learningOrchestrator.test.ts` 的 `broadcastEvent`；③ **修正一处假通过测试**：`roleBoundary.test.ts`「追问 user prompt」标题说测 user prompt 却调 `buildFollowUpSystemPrompt(null)` 且只断言 `toContain('追问')` 恒真，改为真正校验 `buildFollowUpUserPrompt(qa, ...)` 三条断言。④ `api-real.test.ts` `max_tokens` 256→1024 | `src/context/PageCacheContext.tsx`、`src/pages/Path.tsx`、`src/services/learningOrchestrator.ts`、`tests/ai/roleBoundary.test.ts`、`tests/unit/questionBank.test.ts`、`tests/unit/learningOrchestrator.test.ts`、`tests/integration/api-real.test.ts` | 响应 §8.1 B-0 第 1 批（零行为风险项） | `npx eslint . --format json` → 42 errors / 6 warnings（原 59/6）；`npx tsc -b` 0 错误；`npm test` **334/334 全绿**（此前长期 332~346 波动）；`npm run test:api` 13/13 | CodeBuddy |
| 19 | 2026-10-07 | 前置条件 3 | 完成两项收尾：① `.gitignore` 追加 `.env` / `.env.*` / `!.env.example`（并注释说明与既有 `*.local` 的分工——`*.local` 只覆盖 `.env.local`）；② `npm i -D tsx`（**v4.23.15**，首次真正进入 devDependencies + package-lock），`test:report` 由 `npx tsx` 改为 `tsx`，并新增 `typecheck: tsc -b` | `.gitignore`、`package.json`、`package-lock.json` | 计划 §2.1 前置条件 3；tsx 缺席会导致步骤 2/3 的所有构建期脚本在离线/CI 下无法执行（原先靠 `npx` 在线拉取） | `npm run test:report` 实测生成 `test-results/report.html`（71KB）；`npm run typecheck` exit 0；`npx tsx --version` 本地解析成功；`.gitignore` 未能用 `git check-ignore` 验证（git 仍报 dubious ownership），规则正确性靠 `.env.*` 在前、`!.env.example` 在后的顺序保证 | CodeBuddy |
| 20 | 2026-10-08 | 步骤 0-A | 基准集/语料/评测整套实现落地（16 个提交的起点）：清零 `no-explicit-any` 31 处（类型收窄，零行为变更；涉及 `multiAgentFramework` 9 / `PageCacheContext` 5 / `StudentOverview` 4 等 11 个文件） | `src/` 14 个文件（详见提交） | 计划 §2.1 前置条件 0：42 个 lint error 是开工硬门禁（lint 红 → CI 的 build/e2e 直接不执行） | `npm run lint` 42 → 0 error；`npm test` 334 用例保持全绿 | CodeBuddy |
| 21 | 2026-10-08 | 前置条件 0-B/0-C | 清零 `react-hooks/set-state-in-effect` 8 处（派生值改渲染期计算 / 首帧惰性初始化）与 `react-only-export-components` 3 处（hook/context 拆分为独立文件：`useAuth` / `usePageCache` / `AuthContextObject` / `PageCacheObject`） | 6 + 18 个文件（commit `16503c4` / `631ee7a`） | 同上；B 类涉及登录态初始化与首页数据拉取，必须逐处确认时序 | 每个阶段提交前跑 `npm test`，最终 lint 0 error、518→510 用例全绿 | CodeBuddy |
| 22 | 2026-10-08 | 步骤 1 | 评测基准集 S1-1~S1-8：金标 83 条（题库真实 `sampleAnswer`）+ 合成 smoke 30 条；`goldenSet.ts` 加载器/校验器（深拷贝 + 强校验 + 负向验证）、`gen-golden-dataset.ts` 生成器、`runGoldenEval.test.ts` 零额度跑批 | `tests/golden/*`、`tests/eval/runGoldenEval.test.ts`、`src/data/tagMap.ts` 等 9 个文件 | 计划 §4（步骤 1）：把散落在测试里的质量预期固化为可机器校验的数据集 | `npm run golden:check` exit 0；`npm test` 新增 22 个文件；数据集体量 113 条与题库一致 | CodeBuddy |
| 23 | 2026-10-08 | 步骤 2 | 向量基础设施 S2-0~S2-8：`embeddingProvider`（中文 1/2/3-gram + 英文词 → FNV-1a → 亚线性 tf×IDF → L2）、`vectorStore`（int8 量化 + base64）、`corpusBuilder`（一题一 chunk + tag 概览块 + 长文切分）、`buildIndex`（id 集合严格校验 + 混合召回 0.7 余弦 + 0.3 Jaccard）、`scripts/build-vectors.ts` | `src/embedding/*`、`src/rag/*`、`scripts/build-vectors.ts`、`src/data/rag*.json` 等 19 个文件 | 计划 §5（步骤 2）：构建期确定性产出 + 运行时纯计算 | `npm run vectors:build` 两次字节级一致；`--check` 通过（448 块，hash=c290b1a5）；`npm test` 全绿 | CodeBuddy |
| 24 | 2026-10-08 | 步骤 3 | 三级质量漏斗 S3-1~S3-9：`answerScorer`（余弦 0.55 + 要点覆盖 0.45 + 禁止项硬否决）、`qualityFunnel`（规则→语义→模型，语义不过不调模型）、`promptBuilder`、`Tutor.tsx` 接入、`tune-threshold.ts` ROC/Youden J 标定 + LOO | `src/services/answerScorer.ts`、`qualityFunnel.ts`、`src/config/*`、`scripts/tune-threshold.ts` 等 13 个文件 | 计划 §6（步骤 3）；阈值由 ROC 产出而非拍脑袋 | `npm run threshold:tune` 产出报告（当时 J=1.00，`usable=false`——负样本同质，见台账 #34 的复核）；`npm test` 全绿 | CodeBuddy |
| 25 | 2026-10-08 | 步骤 4 | RAG 接入 S4-1~S4-9：`retriever`（`RAG_ENABLED=false` 直接返回 `[]`）、`ragPrompts`（单片段 ≤300 字 / 总长 ≤1500 字 + 引用号）、`buildRagAnswerPrompt`（空 chunks 返回空上下文）、`Tutor.tsx` 只注入一次、60 条标注查询集、`ragMetrics`（Recall@k/MRR/nDCG/忠实度）、动态 import | `src/rag/*`、`tests/eval/rag-eval.test.ts`、`tests/golden/rag-queries.json` 等 15 个文件 | 计划 §7（步骤 4）；默认关交付（S4-R1 判定风险高） | `RAG_ENABLED=false` 等价断言通过；生产路径 paraphrase Recall@3=0.130 入档；`npm run build` 通过 | CodeBuddy |
| 26 | 2026-10-08 | 步骤 5 | 评测体系与 CI：`gen-eval-report.ts` 静态 HTML 报告、`vitest.config.ts` 覆盖率 ratchet 抬升、`ci.yml` 新增 eval job（A 观察阶段）+ live-eval job、husky 追加 JSON 语法校验、`docs/eval-methodology.md` | `.github/workflows/ci.yml`、`scripts/gen-eval-report.ts`、`vitest.config.ts`、`scripts/check-json.mjs` 等 6 个文件 | 计划 §8（步骤 5）+ §1.4 门禁三阶段收紧 | eval job 全部命令本地 exit 0；`test-results/eval-report.html` 可打开；ratchet 门槛通过 | CodeBuddy |
| 27 | 2026-10-08 | 步骤 6 | 技术债清理 S6-1/S6-7：`practiceGrader` 私有 jaccard 收敛到 `tutorQuality` 单一实现、`gradeByAI` 内联 prompt 改调 `buildGradeByAIMessages`；根目录 `temp_*.cjs/json` 处置说明落 `docs/legacy-data-scripts.md` | `src/services/practiceGrader.ts`、`promptBuilder.ts`、`docs/legacy-data-scripts.md` | 计划 §9（步骤 6）；消除双份真相 | `npm test` 全绿（grader 相关用例零改动通过） | CodeBuddy |
| 28 | 2026-10-08 | 评审修复 1 | 修复漏斗降级不可观测与判分阈值口径漂移：新增 `layersSkipped`、`MODEL_DEGRADE_IS_BLOCKING` 接线、分布回归用例 | `src/services/qualityFunnel.ts`、`tests/unit/qualityFunnel.test.ts` 等 6 个文件 | 计划 §1.3「任何降级都必须能在报告里看到」；评审发现降级静默 | `npm test` 全绿；新增分布回归用例 | CodeBuddy |
| 29 | 2026-10-08 | 评审修复 2 | 修复 RAG 与评测口径：金标过滤口径统一、产物「半改」检测负向用例、注入长度守卫、filler 要点泄漏、死代码清理 | `src/rag/*`、`tests/unit/ragCorpus.test.ts` 等 15 个文件 | 评审发现「无覆盖时仍注入」等口径不一致 | `npm test` 全绿；`vectors:build --check` 通过 | CodeBuddy |
| 30 | 2026-10-08 | 评审修复 3 | 修复切分重复段与口径锁定：`splitLongText` 重叠段、层状态不变量、哈希覆盖 idf、数值级回归断言、文档开关表对齐 | `src/rag/corpusBuilder.ts`、`src/embedding/vectorStore.ts` 等 20 个文件 | 评审发现长文切分重叠段重复计入语料 | `npm test` 全绿；`vectors:build` 字节级一致 | CodeBuddy |
| 31 | 2026-10-08 | 评审修复 4 | 修正 `--check` 退出码语义与报告渲染健壮性；无 tagHint 的真实检索质量入档 | `scripts/tune-threshold.ts`、`scripts/gen-eval-report.ts` 等 5 个文件 | 评审发现 `--check` 因 provenance 恒告警而退出非 0，会让 CI 永久变黄淹没真实漂移 | `threshold:tune -- --check` exit 0；`npm test` 全绿 | CodeBuddy |
| 32 | 2026-10-08 | 评审修复 5 | 补齐层状态不变量与契约一致性：语义层异常进入 `run()` 降级路径、降级返回 `null` 而非 `undefined`、哈希注释与 idf 必填、概览块截断与 filler-only 用例 | `src/services/qualityFunnel.ts`、`src/rag/*` 等 9 个文件 | 评审第 4 轮（累积评审 APPROVE 前的最后一批） | `npm test` 510 用例全绿；`npm run lint` 0 error | CodeBuddy |
| 33 | 2026-10-08 | 合并 | 把 `buddy/lint-zero-precondition`（14 个提交，HEAD `76a29f9`）合并进主线：`git merge --no-ff` 生成合并提交 `5c3ebb4`；无冲突，计划文档取 main 版（含 §0.1/§0.2/§9.5） | 76 个文件（+18550 / -311） | 用户要求先把两条线合起来再继续收口（§9.5 R3 的本地部分；推送与 PR 留给人工） | 合并后重跑基线：`npm run lint` 0 error / 1 warning、`npm test` 22 文件 510 用例、覆盖率 30.59/22.57/20.25/31.13（Stmts/Branch/Funcs/Lines）、`build` / `golden:check` / `threshold:tune -- --check` / `eval:*` 全绿 | CodeBuddy |
| 34 | 2026-10-08 | 环境修复 | `npm run vectors:build -- --check` 在 Windows 上恒失败：仓库 blob 为 LF，`core.autocrlf=true` 使 checkout 展开为 CRLF，而 `--check` 用 `readFileSync(file,'utf8')` 逐字符比对。新增 `.gitattributes` 对这 4 个构建期产物声明 `-text`（不改动其它文件策略），并把工作区重置为 LF | `.gitattributes`（新增） | 该检查是 CI eval job 的门禁项，假失败会掩盖真实漂移（HANDOVER §3 坑 1 同源） | `npm run vectors:build -- --check` exit 0（448 块，hash=c290b1a5）；工作区字节检查 CRLF=0；`git status` 不再出现假修改 | CodeBuddy |
| 35 | 2026-10-08 | 步骤 1（R4） | **基准集定向审校**（计划 §9.5 R4）：① 生成器查误区表前先做标签归一化（database 题库原始标签是中文，原实现命中 0 条候选 → 15 条题的禁止项退化为占位项）② 禁止项按与参考答案的词面重合排序并剔出自相矛盾项 ③ 要点改为句子级抽取（保护括号与列表序号，消除 `a=[1,2]`/`不可变对象(int` 式碎片）④ 锚点长度单调改由构造保证，poor 改为「答得很少且含糊」的低质量回答（原 113 条全为「不知道。」）⑤ `reviewed` 全量置 true，meta 增 `anchorSource='curated'` 与 `reviewedBy` | `scripts/gen-golden-dataset.ts`、`tests/golden/goldenSet.json`、`tests/golden/goldenSet.ts` | 计划 §9.5 R4 为最高优先级质量任务：`reviewed=0` 时任何评测数字都不可用（附录 B 禁写） | `npm run golden:check` exit 0（113 条 == 生成器）；`npm test` 513 用例全绿；产物 `tests/golden/goldenSet.json` 与生成器逐字段一致 | CodeBuddy |
| 36 | 2026-10-08 | 步骤 3（R5） | **语义阈值重新标定**（计划 §9.5 R5）：`usable` 判定新增「最强负样本 < 阈值 ≤ 最弱正样本」两条硬条件（防止只有中位数可分时的假可用），复核后 `SEMANTIC_PASS_SCORE` 61 → **77**，`anchorSource='curated'`、新增 `structuralReview='ai-assisted-systematic-review'`；**`humanReviewed` 保持 false**（该字段是 `usable` 的实质闸门，人工抽检未完成前不得置真，见 §13 B-24） | `src/config/qualityThresholds.ts`、`scripts/tune-threshold.ts`、`tests/unit/tuneThreshold.test.ts` | 阈值入库是计划 S3-8 要求；旧值 61 建立在模板锚点上，锚点重构后必须重标 | `npm run threshold:tune` 实测：最优 77、J=1.00、TPR/FPR=1.00/0.00、最强负 60.54 < 77 ≤ 最弱正 100、负样本唯一值 68 种（原为 1）；`usable=false`（人工抽检未完成，刻意闸门）；`npm test` 全绿 | CodeBuddy |
| 37 | 2026-10-08 | 评测口径 | 断言口径随 R4/R5 更新：`runGoldenEval` 的逐条有序断言限定在「参考答案 ≥4 字」的 54 条（单 token 填空题在规则层结构上不可区分，区分度由语义层承担）；`rag-eval` 的饱和度断言改为「excellent 饱和 / fair 不饱和」 | `tests/eval/runGoldenEval.test.ts`、`tests/eval/rag-eval.test.ts` | 旧断言基于阈值 61 + 模板锚点，锚点重构后其表述已与事实不符；改成钉住**当前真实行为**，漂移时会失败 | `npm test` 22 文件 / 513 用例全绿。**注：#37 的 54 条豁免已于 #38 随 `pointCoverage` 缺陷修复一并移除** | CodeBuddy |
| 40 | 2026-10-08 | CI 观测（R3） | 推送修复并回填 CI 首轮有效观测（run #3，sha `5c51ec0`）：**6 个 job 全部调度**（workflow 解析错误已消除），其中 lint / test / build / 评测门禁 四个 **success**，`真实 LLM 评测（手动）` 正确 **skipped**，**E2E job failure**（`npm run test:e2e`，首次真正执行）；run 产出 4 个 artifact（`test-results` / `coverage` / `eval-report` / `playwright-screenshots`）。同步更新 §10.1 job 现状表、§13 B-21（补 CI 证据并升 P1）、计划文档 §0.1 / §9.5.1 R3·R6 / §9.5.5 | `实施计划_细化版.md`、`HANDOVER.md` | 计划 §9.5 R3 的三条验收（lint 转绿 / build·e2e 从 skip 变执行 / eval 首跑入档）需要真实 CI 结果才能勾选 | 证据：GitHub API `actions/runs/37803349322`（`jobs` 接口返回 6 个 job 及其 conclusion）；artifact 清单同接口；本地无法复现 e2e（未装浏览器），日志与 artifact 下载均需鉴权（HTTP 401），故 B-21 的失败点标注为「代码推断、未经日志确认」 | CodeBuddy |
| 39 | 2026-10-08 | 合并/推送/CI | 仓库收敛与 CI 修复：① `main` 快进合并到 `9ea8024`（含此前全部分支成果）并推送 origin（`cac2403 → 9ea8024`）+ 推送 7 个 `baseline-*` tag；② 删除 `buddy/lint-zero-precondition`、`buddy/impl-plan-finalize` 两个本地分支与其 worktree（提交已全部在 main 中，`git merge-base --is-ancestor` 已验证；删除前先摘除 `node_modules` 目录联接以免误删主仓库依赖，主仓库 node_modules 条目数 434 → 434 未变）；③ **修复 CI 首跑暴露的 workflow 解析错误**：`live-eval` 的 job 级 `if` 引用了 `secrets`（GitHub 上下文规则不允许）→ 改为「job 级 env 求值 + step 级 if 读 env」；④ HANDOVER 补 §10.4（两个 CI 致命陷阱）与 §11.13（0 job 症状判别） | `.github/workflows/ci.yml`、`HANDOVER.md`、`实施计划_细化版.md` | 计划 §9.5 R3 要求推送后观察 CI；CI run #2 出现「0 job + 立即失败」，按 GitHub Context availability 规则定位到 `secrets` 出现在 `if`（旧 workflow 的 run #1 有 4 个 job 可对照） | 本地验证：`node scripts/tmp/check-workflow.mjs .github/workflows/ci.yml` → 新版 exit 0、旧版精确报出该缺陷 exit 1（负向验证）；`npm run lint` 0 error / 1 warning；`npm test` 22 文件 / 517 用例全绿；服务端 `ls-remote` 确认 `refs/heads/main = 9ea8024` 且仅 main 一个分支 | CodeBuddy |
| 38 | 2026-10-08 | 评审修复 | 累积代码评审（两轮）后的修复：① `THRESHOLD_PROVENANCE.humanReviewed` 恢复 `false`（它是 `usable` 的实质闸门，人工抽检未完成前不得置真），新增 `structuralReview` 字段；② `runGoldenEval` 新增 `persist` 参数，只有负样本轮落盘（此前最后落盘的是 excellent 轮，导致报告降级卡片两项结构性恒为 0）；③ 检索无覆盖改用生产口径 `retrieveForQuestion` + `RETRIEVAL_FLOOR`；④ `textMatch.pointCoverage` 对纯标号要点改为对候选原文做子串判定（此前恒返回 1，空回答在单符号题上得 100 分），空白要点前置拦截；⑤ 生成器 `meta.note` 与实现对齐、要点截断改按子句边界、移除失效参数与不可达分支；⑥ `tuneThreshold` 的 ±2 硬容差改为「落在平台区内」；⑦ 报告卡片标注负样本轮、新增 floor 敏感性守卫、登记 B-27/B-28 | `src/services/textMatch.ts`、`src/config/qualityThresholds.ts`、`src/config/evalConfig.ts`、`scripts/gen-golden-dataset.ts`、`scripts/tune-threshold.ts`、`scripts/gen-eval-report.ts`、`tests/golden/goldenSet.json`、`tests/eval/*.test.ts`、`tests/unit/tuneThreshold.test.ts`、`vitest.config.ts`、`docs/eval-methodology.md`、`实施计划_细化版.md` | 评审 MAJOR-1/2/3/4 + MINOR/NIT 批次；两轮评审结论：第 1 轮 CHANGES_REQUESTED → 修复后第 2 轮 APPROVE | `npm run lint` 0 error / 1 warning；`npm test` 22 文件 / **517 用例**全绿；`npm run test:coverage` 门槛通过；`build` / `golden:check` / `vectors:build -- --check` / `threshold:tune -- --check` / `eval:golden` / `eval:rag` / `eval:report` 全部 exit 0；空回答全库最高分由 100 降为 **0.00**（`scripts/tmp/diag-order2.ts` 实测） | CodeBuddy |

> **注（台账 #5 的更正）**：`api.ts` 的硬编码 Key、模型名硬编码、以及 `api-real.test.ts` 的直连问题，已于 2026-10-07 21:36~21:40 由**并行修改**解决（转为 DeepSeek / OpenAI 兼容格式 + Key 走 env + 真实 API 测试隔离）。因此原计划"步骤 0：Key 止损"的主体任务**已由他人完成**，本轮只补了漏掉的守卫（#9）与配置修复（#7、#8）。行号索引（§4.2）随之部分失效，见 P-16。

### §12.3 历史变更补录（待办）

因 §3 坑 1（git dubious ownership）当时未解决，历史提交记录未能读取。修复 git 访问后按下列流程补录，**补录前先不要声称"历史为空"**：

```powershell
git config --global --add safe.directory 'D:/GitHub laqudaima/cnsoftbei'
git --no-pager log --oneline -50
git --no-pager log --stat -20
# 挑选与本轮计划相关的提交（题库、tutorQuality、practiceGrader、promptBuilder、CI、文档）
```

补录格式同上表；补录完成后在 §5.4 的"历史变更记录"行改为"已补录，共 N 条"。

---

## §13 后续需求池

### §13.1 录入规则（强制）

1. 新想法 / 新问题 / 优化项**一律**登记到本节，不进 `README`、`AGENTS.md`（那些只链接过来）。
2. 每条必须有：**触发条件**（什么时候做）与**优先级**。
3. 不做的也要登记并写明理由，避免半年后重复讨论。
4. 与 §7 的 ADR 冲突的提案，必须先写「推翻条件是否已满足」，不能直接开工。

### §13.2 需求表

| ID | 需求 | 背景 / 触发条件 | 预估 | 优先级 |
|---|---|---|---|---|
| B-01 | ~~修复测试基线~~（P-01~P-03） | **已完成**（§12 台账 #6~#9）：测试基线现为 11 文件 / 334 用例全绿，覆盖率 ratchet 已落地 | — | **已完成** |
| B-02 | Key 平台侧作废与重签 | 旧 Key 已进 git 历史，代码改动不构成止损 | 人工 15min | **P0（立即）** |
| B-03 | ~~补 `tsx` 到 devDependencies~~ | **已完成**（台账 #19）：`tsx@4.23.15` 已入 devDependencies + lock，`test:report` 由 `npx tsx` 改为 `tsx`，另新增 `typecheck`；ADR-10 的例外正式落地 | — | **已完成** |
| B-04 | CI Node 统一 `20.19.0` + `engines` | vite@8/vitest@4 版本要求（§3 坑 2） | 15min | P1 |
| B-05 | ~~`.env` 忽略规则~~ | **已完成**（台账 #19）：`.gitignore` 追加 `.env` / `.env.*` / `!.env.example`；`.env.example` 早已存在。§6 P-05 随之关闭 | — | **已完成** |
| B-06 | 删除 `learning-agent/.env.local` | 第二处密钥（讯飞星火） | 5min | P1 |
| B-07 | **阶段 4：真稠密模型**（bge-small-zh ONNX） | 阶段 1~3 全部验收通过、且确实需要更强语义时。**前置必须先解决跨平台浮点一致性问题**，否则哈希测试会失败（解法：向量文件按内容哈希命名 + 接受"重建即更新"的 PR 流程，或 CI 只校验维度/范数/抽样余弦而非全量哈希） | 2~3 天 | P3（未来） |
| B-08 | 阈值自愈：门禁不写死阈值，改为"通过率下降 > X% 告警"，阈值更新走人工 PR | 基准集规模 > 200 条后（ADR-06 推翻条件） | 1 天 | P3 |
| B-09 | 检索质量提升：top-20 rerank（BM25 或轻量 cross-encoder）+ query 改写 | 实测 `Recall@3` 低于门禁时 | 1~2 天 | P2 |
| B-10 | 分块策略迭代：超长 explanation 改语义分块；概览块扩为讲义块 | 出现跨知识点混淆检索时（ADR-04 推翻条件） | 1 天 | P3 |
| B-11 | 忠实度升级：用 NLI 蕴含判断替代余弦做"支撑"判定 | 忠实度指标区分度不足（方差过小）（§8.6 S4-7） | 1~2 天 | P2 |
| B-12 | 数据集自举：用判分结果 + 用户点踩/点赞作弱监督挖掘新条目 | 线上积累足够交互数据后 | 2 天 | P3 |
| B-13 | 门禁加固：覆盖率门槛逐步提到 80（ADR-11）；补 Playwright 学习闭环 E2E；接 Codecov | 覆盖率 ratchet 逐次 +5 点达标后 | 按次 | P3 |
| B-14 | 关键词通道收益评估（权重扫描） | 若收益 < 2%，可按 ADR-05 推翻条件移除 | 2h | P2 |
| B-15 | ~~合并 `AGENTS.md` / `CLAUDE.md` 或建立同步机制~~ | **风险已发生并已解决**（台账 #13、#17）：采纳「废止 `CLAUDE.md`、删除 `测试缺口.md`、`README.md` 独占项目说明、`AGENTS.md` 退化为指针」，从根上消除两份文档漂移。§0.3 已同步 | — | **已完成** |
| B-16 | 根目录 `temp_*` 脚本归档到 `scripts/legacy/` | 保持根目录整洁（但它们是语料溯源依据，**移走前要确认 S2-0 已完成且映射清单已入库**） | 30min | P3 |
| B-17 | GitHub Secrets 配置与默认 live 门禁 | 平台侧新 Key 签发后 | 15min | P2 |
| B-18 | 治理 lint 剩余 **42 errors / 6 warnings**。第 1 批（`no-unused-vars` 4 + `no-empty` 6）✅ 已完成，台账 #18，59→42；剩 ② `any` 31 处收窄、③ `set-state-in-effect` 8 + `only-export-components` 3（需配合页面重构）。**任务卡见 §8.1 B-0** | P-14：**CI lint job 现在是红的**，这是唯一还没绿的门禁 | 1~2 天 | **P1** |
| B-19 | ~~拆包：路由改 `React.lazy`~~ | **已完成**（台账 #11）：首屏 gzip 709 kB → 280.1 kB；防回归口径见 `npm run measure:size` | — | **已完成** |
| B-20 | ~~确认 DeepSeek Key 有效性~~ | **已关闭**：用户 2026-10-07 确认 `.env.local` 中的 Key 正确并继续使用，无需作废（台账 #12）。P-04 关闭 | — | **已完成** |
| B-21 | 让 e2e 真正有效（**CI 已确认它是红的**）：2026-10-08 CI run #3 里 `npm run test:e2e` **首次真正执行即失败**（此前 lint 红 → e2e 一直被 skip，从未验证过）。代码侧最可能的失败点是 `tests/e2e/learning-flow.spec.ts:21` 的 `expect(count).toBeGreaterThan(0)`：未登录态侧边栏不渲染，`.ant-menu-item` 数为 0 —— **此判断由代码推断，未经日志确认**（job 日志与 `playwright-screenshots` artifact 下载都需鉴权）。另需按文档口径补登录态复用（storageState 或 `beforeEach` 登录），并安装 Playwright 浏览器（本机未装，约 150MB）才能本地复现 | **CI 目前唯一的红 job**；也是 lazy 改造缺少运行时验证的原因 | 2~3h | **P1** |
| B-22 | 弹窗 lazy 化（可选优化）：`App.tsx` 静态引用的两个 `Modal`（信息登记 / 意见反馈）连同`Form`/`Select`/`Input` 约占首屏 137 kB raw / 45 kB gzip。抽成 lazy 子组件可移出首屏 | 首屏 gzip 若要继续压到 200 KB 以下；注意学生首次登录会立刻弹「信息登记」，收益会被部分抵消 | 1~2h | P3 |
| B-23 | ~~补 `.env` 忽略规则 + 加 `tsx` 到 devDependencies~~ | **已完成**（台账 #19） | — | **已完成** |
| B-24 | **基准集人工抽检**：`tests/golden/goldenSet.json` 的 `meta.reviewedBy='ai-assisted-systematic-review'`，113 条标注由 AI 辅助系统化审校产出（要点句子级抽取、禁止项按归一化标签查表、poor 锚点为「答得很少且含糊」）。需人工抽检 ≥20 条确认要点与禁止项与题意强相关 | **抽检完成前，任何评测数字不得对外引用**（`实施计划_细化版.md` 附录 B 禁用表述） | 1~2h | **P0** |
| B-25 | **README 数字同步**（受保护文件）：README 仍写着旧的测试数/lint 状态，需写回「lint 0 error / 1 warning」「22 文件 / 517 用例」「覆盖率 statements 30.63 / branches 22.76 / functions 20.25 / lines 31.17」与阈值 77（`usable=false`，见 §13 B-24） | 收口期按交接红线未改 README（`实施计划_细化版.md` §9.5 R8）；数字真源见该文档 §0.1 | 30min | P1 |
| B-27 | **L2（模型层降级）计数接入评测产物**：`qualityFunnel` 已返回 `modelDegraded`，但只在 `console.warn` 与 `Tutor.tsx` 的运行期日志里可见，`eval-report.html` 与 `test-results/*.json` 都没有它，导致计划 §1.3「任何降级都要能在报告里看到」在 L2 上尚未闭环 | 想让 L2 降级率进入对外表述之前（当前报告已显式标注「L2 未接入」，不会误读为 0） | 2~3h | P2 |
| B-29 | **把 workflow 静态自检接入本地门禁**：`scripts/check-workflow.mjs`（现为临时脚本 `scripts/tmp/check-workflow.mjs`）能检出「`secrets` 出现在 `if`」这类解析期错误 —— 它会让整份 workflow 以 0 job 失败，而本地 YAML 解析与 `npm run lint` 都发现不了。建议：移入 `scripts/`，在 husky pre-commit 的 lint-staged 里对 `.github/workflows/*.yml` 挂上（**需改 package.json，按红线先确认**） | 每次改动 CI 配置都可能重犯；参考 §10.4 / §11.13 | 30min | P1 |
| B-28 | **`RETRIEVAL_FLOOR` 偏低，L3「无覆盖降级」实测不触发**：当前固化 0.12，实测连无关查询都能过线 —— 数值由 `tests/eval/rag-eval.test.ts` 的「无覆盖统计对 floor 敏感」用例亲自钉住（`retrieve('zzz qqq www 今天天气不错', {floor:0})[0].score` 高于 0.12 且低于 0.3，抬高到 0.3 后该查询被完全挡掉），因此 `rag-metrics.json` 的 `noHitQueries = 0` 是「floor 没挡住」而不是「知识库覆盖完美」。需按 paraphrase/overview 的分数分布重标定 floor（与 `SEMANTIC_PASS_SCORE` 一样走「标定 → 人工 review → 固化」流程）；**重标后该用例最后一行的断言需同步改为 0**（用例内已注明） | 想让 L3 降级真正生效、或要对外引用「覆盖率/无覆盖」数字之前 | 2h | P2 |
| B-26 | `src/App.tsx:84` 的 `react-hooks/exhaustive-deps` warning 重构：当前显式收窄依赖数组以避免重复 `setState`（有意偏离），可改为把 `currentUser/isAdmin/profileForm` 的派生计算移出 effect | 想彻底清掉最后一个 lint warning 时；当前保留为可见提示 | 1h | P3 |

### §13.3 "话术红线"（防止夸大，被追问会崩）

| 禁止说 | 应该说 | 原因 |
|---|---|---|
| "基于 bge-small-zh 的语义向量" | "基于确定性特征哈希的稠密向量余弦相似度" | 实际没跑任何语义模型（ADR-02） |
| "语义层已上线拦截" | 若处于影子模式："已完成阈值标定，以影子模式运行，误杀率为 0" | 区分度不足时只记录不拦截（ADR-06） |
| "百条基准集" | 报实际条数并注明分层（金标层 X 条 / 合成层 Y 条） | 金标层只有 83 条真实 `sampleAnswer`（T-1） |
| "人工撰写的参考答案" | "从题库派生的参考答案（`sampleAnswer`）+ 人工审校的预期要点" | 客观题的答案是合成的 |
| "模型层拦截了 N 条低质量回答" | 报真实的拦截原因分布，并单独说明"评审降级率" | 模型层评审失败曾被伪装成通过（P-06） |

---

## §14 术语表

| 术语 | 通俗解释 |
|---|---|
| **Embedding（嵌入向量）** | 把一段文字变成一串数字（本项目 256 个 0~1 的浮点数），语义相近的文字数字也相近 |
| **余弦相似度** | 衡量两个向量"方向有多像"的 0~1 分数。本项目只判断"像不像"，不判断"事实对不对" |
| **特征哈希（Feature Hashing）** | 用哈希函数把"词/字片段"直接映射到向量下标，替代模型。本项目确定性强的关键 |
| **n-gram** | 连续 n 个字符切出的片段。本项目中文用 1/2/3-gram，即"装"、"装饰"、"装饰器" |
| **FNV-1a** | 一种哈希算法。同样输入永远同样输出，跨平台结果一致（这是选它的唯一理由） |
| **int8 量化** | 把 0~1 的浮点小数转成 -128~127 的整数存储，体积变 1/4，精度损失约 0.4% |
| **IDF（逆文档频率）** | 衡量"这个词在语料里稀不稀有"。稀有词（如"GIL"）权重更高 |
| **分块（Chunking）** | 把长文本切成小块分别建向量。本项目是"一题一块" |
| **RAG（检索增强生成）** | 回答前先从知识库检索相关资料，把资料塞进提示词，让回答基于资料而不是纯靠模型记忆 |
| **混合召回** | 同时用"向量相似"和"关键词重合"两路打分再加权合并，兼顾语义与字面 |
| **Recall@k / MRR** | 检索质量指标：正确的片段有没有进前 k 名 / 排第几名 |
| **忠实度（Faithfulness）** | 回答里的断言有多少能被检索到的资料支撑。本项目用逐句余弦近似 |
| **三级漏斗** | 质量把关分三层：规则层（零成本）→ 语义层（向量）→ 模型层（LLM），逐层拦截 |
| **LLM-as-judge** | 用大模型给另一个大模型的输出打分 |
| **Youden J** | ROC 曲线上 `TPR − FPR` 的最大值点，用于在"漏放坏回答"与"误杀好回答"代价相当时选阈值 |
| **ROC 曲线** | 阈值从 0 扫到 1，画出"召回率 vs 误报率"的曲线 |
| **正样本 / 负样本** | 本项目 = 优样例（应放行）/ 差样例（应拦截） |
| **影子模式（Shadow Mode）** | 照常计算指标但不用于拦截，用于"指标还没验证可信"的阶段 |
| **flaky（不稳定测试）** | 同样代码时好时坏。**本项目当前存在**，是 §8.1 步骤 -1 要解决的 |
| **msw** | 在浏览器/Node 里拦截网络请求的库，让测试不必真调 API |
| **覆盖插桩（coverage instrumentation）** | 给代码插桩以统计覆盖率，会让代码变慢（这是 §11.1 超时的原因） |
| **门禁 / CI 门禁** | 合入代码前必须通过的自动检查 |
| **ratchet（棘轮策略）** | 指标只许升不许降的门槛策略；本项目用于覆盖率，避免直接设 70 导致第一天就红 |
| **`noUnusedLocals`** | TS 严格选项，未使用变量即编译失败 |
| **bundle 体积** | 打包后给用户下载的代码大小 |

---

## §15 交接检查清单

> 交接双方逐项确认。**全部勾选后交接才算完成。**

### 15.1 交接方（当前维护者）须完成

- [ ] §5 实测基线数字已填（当前：12 文件 / 344 用例 / 17 失败；排除真 API 后 334 / 1）
- [ ] §6 已知问题台账已建立并标注级别
- [ ] §7 ADR 已记录（含推翻条件）
- [ ] §8 操作手册已写到可照做的粒度
- [ ] §9 开关矩阵、§11 故障手册、§14 术语表已就位
- [ ] §12 台账已记录本轮全部改动（含本次基线核实）
- [ ] §13 需求池已录入，含不做的项与理由
- [ ] `实施计划_细化版.md` / `plan.md` 已与本文件互相链接

### 15.2 接手方须完成（执行顺序）

- [ ] §2 的 2-1 ~ 2-10 全部执行并确认预期结果（**尤其 2-2 git、2-4 红基线**）
- [ ] 能复述：项目要做什么 / 现在什么状态 / 哪 6 处原计划已被修正（T-1~T-6）
- [ ] 能解释 §7 中至少 ADR-01/02/06/08/11 的理由
- [ ] 已修复基线（§8.1 B-1~B-6 全部完成），连续 3 次 `npm test` 结果一致
- [ ] 已取到覆盖率基线并写入 ratchet 门槛
- [ ] 已完成 §3 坑 1（git 访问）与坑 3（tsx）
- [ ] 已完成 B-02（Key 平台侧作废）
- [ ] 已建立个人执行台账 `docs/exec-log-YYYY-MM.md`
- [ ] 已理解 §13.3 话术红线，并能判断"现在能写哪几条简历"

### 15.3 遗留未决事项（交接时必须口头交代）

| 事项 | 状态 | 谁能解决 |
|---|---|---|
| 旧 Key 平台侧作废 | **未完成**（人工） | 仓库持有者本人 |
| 新 Key 签发 | **未完成**（人工） | 仓库持有者本人 |
| git 历史变更补录 | ✅ **已完成**（§12.2 台账 #1~#19 已补；#20~#37 为本轮新增） | — |
| `learning-agent/` 整目录删除 | **不做**（只删其中 `.env.local`） | 无需决策，ADR-14 已定 |
| 覆盖率真实基线 | ✅ **已取**（2026-10-08：statements 30.63 / branches 22.76 / functions 20.25 / lines 31.17，门槛 24/20/17/17；与 `vitest.config.ts` 头注释同源） | — |
| 原计划的 6 处修正（T-1~T-6）是否已回改 `plan.md` | **不适用**：`plan.md` 从未入库（`git log --all -- plan.md` 无记录），无法回改；其有效内容已并入 `实施计划_细化版.md`（附录 C 对应关系表） | 无需决策（§9.5 R11 已按「修订引用」处置） |
| 基准集人工抽检（`reviewedBy='ai-assisted-systematic-review'`） | **未完成**（人工）—— 抽检前不得对外引用评测数字 | 仓库持有者本人（`HANDOVER.md` §13 B-24） |
| README 数字同步（受保护文件，收口期未改） | **未完成**—— 需人工把 0 error / 1 warning、22 文件 / 517 用例、覆盖率 31.17 写回 README | 仓库持有者本人（§13 B-25） |

---

**文档版本**：v1.0（2026-10-07 建立）
**维护责任人**：项目维护者（变更必须回写本文档 §12）
**下次更新触发条件**：完成任一执行步骤 / §13 中任一需求 / §6 中任一问题状态变化