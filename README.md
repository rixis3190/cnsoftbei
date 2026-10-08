# 学习智能体系统（Learning Agent）

> 第十五届中国软件杯 · A3 赛题
> AI 驱动的个性化学习平台，通过多智能体协作把「画像 → 路径 → 练习 → 评估」收敛为可闭环执行的单一控制面。

本文档是本项目**唯一权威说明文档**，已合并原 `README.md`、`AGENTS.md`、`CLAUDE.md`、`测试缺口.md` 的全部有效信息，并按当前代码实测结果校准。

---

## 一、项目简介

### 1.1 定位

学习智能体系统是一个**纯前端**的 AI 辅助学习平台。它没有自建后端服务，所有「智能体」能力通过调用 DeepSeek 大模型（OpenAI 兼容格式）在浏览器端完成，用户数据持久化在浏览器 `localStorage` 中。

系统由 5 个智能体角色协作构成学习闭环：

| 智能体 | 职责 |
|--------|------|
| 画像构建智能体 | 对话式收集学习者信息，产出 6 维度结构化画像 |
| 资源生成智能体 | 按主题批量生成 6 类学习资源 |
| 路径规划智能体 | 由画像驱动生成「入门→基础→进阶→实战」四阶段学习路径 |
| 智能辅导智能体 | 流式问答、追问链、点踩重生成、回答质量校验 |
| 效果评估智能体 | 汇总练习数据，回写画像并给出优化建议 |

### 1.2 技术栈

| 层次 | 选型 |
|------|------|
| 框架 | React 19.2 + TypeScript ~6.0 |
| 构建 | Vite 8（`@vitejs/plugin-react`） |
| UI | Ant Design 6.3 + `@ant-design/icons` + Recharts 3.8 |
| Markdown | react-markdown 10 + remark-gfm + react-syntax-highlighter（Prism / oneDark） |
| 网络 | axios（非流式）+ 原生 fetch / ReadableStream（流式） |
| 大模型 | DeepSeek（`deepseek-flash` / `deepseek-v4-pro`），OpenAI 兼容格式 |
| 测试 | Vitest 4.1 + Testing Library + msw 2.14 + Playwright 1.60 |
| 质量 | ESLint 9 + husky 9 + lint-staged 17 + GitHub Actions |

### 1.3 环境要求

- Node.js 20+（CI 使用 Node 20）
- npm 10+
- 有效的 DeepSeek API Key（见 [七、注意事项](#七注意事项)）

---

## 二、功能说明

### 2.1 页面与菜单

路由为**手动切换**（`useState` + `switch`，非 React Router），共 11 个页面组件。

**学生 / 教师可见（7 项）**

| 页面 | key | 状态 | 说明 |
|------|-----|------|------|
| 登录 | — | ✅ 已实现 | 用户名密码登录 + 注册，内置 3 个预置账号 |
| 首页 | `home` | 静态数据 | 学习仪表盘、快捷入口、智能体状态 |
| 学习画像 | `profile` | ✅ 接入 API | 对话式画像构建 / 6 维问卷测评，AI 分析后写入画像 |
| 资源生成 | `resources` | ✅ 接入 API | 6 类资源流式生成，展示生成进度 |
| 学习路径 | `path` | ✅ 接入 API | 阶段划分、目标、时长、解锁条件、阶段状态管理与跳转 |
| 练习中心 | `practice` | ✅ 接入 API + 持久化 | Python 练习、客观题自动判分、简答题 AI 判分、错题集 |
| 智能辅导 | `tutor` | ✅ 接入 API + 多轮优化 | 流式问答、4 种解答模式、追问链、缓存、点踩重生成 |
| 效果评估 | `assessment` | ✅ 已与练习打通 | 读取真实练习数据、6 维雷达图、趋势与建议 |

**管理端（按角色显示）**

| 页面 | key | 可见角色 | 说明 |
|------|-----|----------|------|
| 学生总览 | `admin/students` | 教师 + 管理员 | 全班学生画像与练习进度总览 |
| 用户管理 | `admin/users` | 仅管理员 | 删除用户、修改角色、重置密码 |
| 反馈管理 | `admin/feedback` | 仅管理员 | 查看/标记处理/删除用户反馈 |

> 管理员登录后会隐藏全部学习模块菜单（`profile`/`resources`/`path`/`practice`/`tutor`/`assessment`）。

### 2.2 角色与权限

三种角色：`student`（学生）、`teacher`（教师）、`admin`（管理员）。

| 账号 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 管理员 |
| `teacher1` | `teacher123` | 教师 |
| `student1` | `student123` | 学生 |

- 认证为前端模拟：用户表存于 `localStorage.users`，登录态存于 `localStorage.currentUser`，首次启动自动 seed 预置账号。
- **用户数据隔离**：所有业务数据 key 以用户 ID 作前缀（`{userId}_studentProfile` 等），多账号切换互不污染。
- 学生/教师首次登录会弹出「信息登记」弹窗（姓名 / 专业 / 年级），可跳过（使用默认值）。

### 2.3 核心功能细节

#### 练习中心（`src/pages/Practice.tsx`）

- **题库**：4 种题型 —— 单选 `choice`、判断 `truefalse`、填空 `fill`、简答 `short`。
- **判分**：
  - 客观题（选择/判断/填空）本地自动判分，填空题忽略大小写与首尾空格。
  - 简答题调用大模型判分，提示词要求「只输出一个 0-100 整数」。
  - 分数提取：取回答中所有数字、clamp 到 0-100 后的**最大值**（避免解释中的低分误导）。
  - `gradeByAIVerified`：并发 3 次取中位数，偏差 >20 或触发合理性断言时标记 `low` 置信度并自动重试一次。
  - `assertScoreReasonable`：基于答案 Jaccard 相似度的零成本断言，拦截「高相似度低分」「低相似度高分」「极短答案高分」三类异常判分。
- **模块进度**：客观题 50% 权重 + 简答题 50% 权重，已对「模块内无客观题」做除零保护。
- **标签维度得分**：题目按 Tag 加权计分（客观题 0/1，简答题 `aiScore/100`），未评分的简答题不参与计分。
- **学以致用**：做题结果按 Tag 映射回画像 6 维度，自动更新画像 level（高/中/低）与描述文案。
- **题目检索**：Tag 倒排索引（`tagIndex`）、按完成状态排序、按当前学习阶段筛选、按难度筛选、错题集（按模块/按 Tag 分类）。

#### 智能辅导（`src/pages/Tutor.tsx`）

- 4 种解答模式：文字 / 图解 / 视频脚本 / 代码示例，各模式有独立 system prompt。
- 流式输出 + 思考过程展示，支持 `AbortSignal` 取消。
- 回答缓存：按 `问题|||模式` 去重，不同模式独立缓存。
- 追问链：`QAItem` 用 `parentId` / `followUpIds` 组织，追问缩进展示，详情弹窗展示完整追问链。
- 追问流程 v2：不在回答下方显式给追问按钮，由 AI 依据上下文自行判断；点击历史追问不清空当前回答，追问回答顶部回显关联的原始问题卡片。
- 历史管理：详情弹窗、删除（级联删除追问）、赞/踩变色反馈。
- 点踩重生成：点踩仅标记，再次提问时触发重新回答（含原因分析 + 全新解答）。
- 回答质量校验（`tutorQuality.ts`）：零成本规则校验（过短、拒绝性语句、关键词零重叠）+ 关键词 Jaccard 粗筛匹配历史问答。
- 画像注入：读取当前用户画像注入 system prompt，AI 按 6 维度调整回答风格与深度。

#### 资源生成（`src/pages/Resources.tsx`）

`ResourceGenerator` 支持 6 类资源：`document`（讲解文档）、`mindmap`（思维导图）、`quiz`（练习题）、`reading`（拓展阅读）、`video`（教学视频脚本）、`codeCase`（代码案例）。生成过程流式展示，可中止。

#### 中央调度协议（`src/services/learningOrchestrator.ts`）

定义学习闭环的统一 JSON 协议：

- **画像是唯一核心数据源**：结构化输出含用户基础信息、6 维标签、更新时间、来源标记。
- **路径必须由画像驱动**：阶段固定为「入门→基础→进阶→实战」，每阶段输出目标、核心知识点、预计时长、解锁条件。
- **练习按当前阶段核心知识点筛题**：题量不足时启用关联知识点、重复强化与异常报告兜底。
- **评估必须回写画像与练习状态**：产出阶段掌握度、画像更新建议、路径优化建议、练习优化建议。
- **每次闭环迭代记录 cycle log**：保留调整前后的画像、路径、筛选规则与评估结论。

事件总线：`SYSTEM_EVENTS` + `broadcastEvent` / `window` 自定义事件，用于页面间同步刷新。

---

## 三、技术架构

### 3.1 目录结构

```
cnsoftbei/
├── .github/workflows/ci.yml     # GitHub Actions：lint / test / build / e2e
├── .husky/pre-commit            # pre-commit 钩子 → lint-staged
├── public/                      # 静态资源
├── scripts/
│   ├── gen-test-report.ts       # 读取 results.json 生成中文 HTML 测试报告
│   └── tmp/                     # 一次性脚本与草稿（可整体清理）
├── src/
│   ├── App.tsx                  # 布局 + 手动路由 + 信息登记/反馈弹窗
│   ├── main.tsx                 # 入口，挂载 AuthProvider
│   ├── components/
│   │   ├── SideMenu.tsx         # 侧边菜单（按角色过滤）
│   │   ├── MarkdownRenderer.tsx # AI 内容 Markdown 渲染
│   │   └── RadarChart.tsx       # 6 维能力雷达图
│   ├── context/
│   │   ├── AuthContext.tsx      # 登录态与用户管理（前端模拟）
│   │   └── PageCacheContext.tsx # 页面状态缓存，防止切换丢数据
│   ├── data/
│   │   ├── mockData.ts / .json  # 首页/评估/路径/资源/辅导/画像的展示数据
│   │   ├── pythonQuestionBank.ts    # Python 题库（110 题，已接入）
│   │   ├── javaQuestionBank.ts      # Java 题库（160 题，未接入）
│   │   └── databaseQuestionBank.ts  # 数据库题库（135 题，未接入）
│   ├── hooks/useDebounce.ts     # 提交防抖 + loading 锁
│   ├── pages/
│   │   ├── Login / Home / Profile / Resources / Path / Practice / Tutor / Assessment
│   │   └── admin/               # UserManage / StudentOverview / FeedbackManage
│   ├── services/
│   │   ├── api.ts                     # 大模型调用（流式 + 非流式）
│   │   ├── multiAgentFramework.ts     # MultiAgentScheduler + ResourceGenerator
│   │   ├── learningOrchestrator.ts    # 中央调度协议
│   │   ├── practiceGrader.ts          # 判分、模块进度、标签得分、闭环回流
│   │   ├── promptBuilder.ts           # 全部 system/user prompt 集中管理
│   │   ├── tutorQuality.ts            # 回答质量校验与关键词匹配
│   │   ├── feedback.ts                # 反馈 CRUD
│   │   └── storage.ts                 # 用户隔离的 localStorage key 工具
│   └── types/index.ts           # 全局类型定义
├── tests/                       # 见「六、测试体系」
├── eslint.config.js
├── vite.config.ts               # /anthropic 代理配置
├── vitest.config.ts
└── playwright.config.ts
```

### 3.2 路由

`App.tsx` 用 `useState` 管理 `selectedKey`，通过 `switch` 渲染页面；`SideMenu` 通过 `onMenuSelect` 回调切换。未登录时 `AppLayout` 直接返回 `<Login />`。

所有 Hook 必须在条件返回之前调用（`App.tsx` 中已遵循此约束）。

### 3.3 状态管理

无全局状态管理库。

- 页面级状态用本地 `useState`。
- 跨页面切换时由 `PageCacheProvider` + `usePageCache(pageKey)` 以 `useRef` 缓存，避免导航导致数据丢失。
- 跨模块刷新走事件总线（`window` 自定义事件）。

### 3.4 API 层（`src/services/api.ts`）

- **端点**：`/deepseek/v1/chat/completions`，由 Vite 开发服务器代理到 `https://api.deepseek.com`（`vite.config.ts`），避免浏览器跨域并避免 Key 暴露在前端源码。
- **模型**：`VITE_DEEPSEEK_MODEL` 指定，默认 `deepseek-flash`；该 Key 可用 `deepseek-flash`、`deepseek-v4-pro`。
- **鉴权**：`Authorization: Bearer <key>`，Key 从 `VITE_DEEPSEEK_API_KEY` 读取。
- **请求体**：`{ model, max_tokens: 8192, messages, stream }`。`system` 提示词作为 `messages` 数组首元素（OpenAI 格式要求），不再使用 Anthropic 的顶层 `system` 字段。
- **`streamChatCompletion(messages, onChunk, onThinking, signal)`**：fetch + `ReadableStream` 手写 SSE 解析。
  - 正文增量 `choices[0].delta.content`
  - 深度思考增量 `choices[0].delta.reasoning_content` → 触发 `onThinking`，并先发一次 `[思考中...]` 占位（保留 Tutor 的思考过程展示）
  - 结束标记 `data: [DONE]`
  - 支持 `AbortSignal` 中止
- **`chatCompletion(messages)`**：axios 非流式，超时 180 秒，最多重试 3 次（超时按 1s/2s/3s 退避），解析 `choices[0].message.content`，错误结构为 `{ error: { type, message } }`。

### 3.5 存储键（`src/services/storage.ts`）

| 键 | 作用域 | 内容 |
|----|--------|------|
| `{userId}_studentProfile` | 用户 | 学习画像（含 `learningProfile` 快照） |
| `{userId}_practiceState` | 用户 | 答题结果、模块进度、标签得分、cycle log |
| `{userId}_learningPathPlan` | 用户 | 学习路径方案 |
| `{userId}_currentPathStage` | 用户 | 当前学习阶段 |
| `users` / `currentUser` | 全局 | 用户表与登录态 |
| `feedbacks` | 全局 | 意见反馈 |

未登录时 `userKey()` 回退为原始 key。

---

## 四、使用方式

### 4.1 安装与启动

```bash
npm install
npm run dev        # 启动开发服务器（默认 http://localhost:5173）
```

浏览器打开后使用预置账号登录（见 [2.2 角色与权限](#22-角色与权限)）。

### 4.2 全部命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（含 HMR） |
| `npm run build` | `tsc -b` 类型检查 + 生产构建 |
| `npm run preview` | 本地预览 `dist/` 构建产物 |
| `npm run lint` | ESLint 检查 |
| `npm test` | Vitest 单次运行（输出 `test-results/results.json`），**不含** `tests/integration` |
| `npm run test:api` | 真实 DeepSeek 接口测试（会消耗额度，需已配置 Key） |
| `npm run test:watch` | Vitest 监听模式 |
| `npm run test:coverage` | 覆盖率报告（v8 → `coverage/index.html`） |
| `npm run test:report` | 跑测试并生成中文 HTML 报告 `test-results/report.html` |
| `npm run test:e2e` | Playwright E2E（自动拉起 dev server） |

### 4.3 典型使用流程

1. 用 `student1 / student123` 登录 → 完成「信息登记」（专业 / 年级）。
2. 进入**学习画像**：与 AI 对话或填写 6 维问卷，生成画像。
3. 进入**学习路径**：AI 按画像生成四阶段路径，确认当前阶段。
4. 进入**练习中心**：按当前阶段知识点筛题，做客观题（自动判分）与简答题（AI 判分）。
5. 进入**效果评估**：查看雷达图、掌握度与优化建议（数据来自真实练习记录）。
6. 进入**智能辅导**：按文字/图解/视频/代码四种模式提问，可追问、点踩重生成。
7. 切换到 `admin / admin123` 可查看用户管理与反馈管理。

### 4.4 代码质量保障

- **pre-commit**：husky → lint-staged → 对 `*.ts` / `*.tsx` 执行 `eslint --fix`。
- **CI**（`.github/workflows/ci.yml`，push 到 `main` / `develop` 及 PR 到 `main` 时触发）：
  `lint` → `test`（含测试报告 artifact）→ `build`，并独立跑 `e2e`（Playwright Chromium，失败时上传截图）。

---

## 五、题库数据

| 题库 | 题目数 | 简答 | 客观 | 状态 |
|------|-------|------|------|------|
| `pythonQuestionBank.ts` | 110 | 8 | 102 | ✅ 已接入练习中心与判分 |
| `javaQuestionBank.ts` | 160 | 60 | 100 | ⚠️ 数据层就绪，未接入页面 |
| `databaseQuestionBank.ts` | 135 | 15 | 120 | ⚠️ 数据层就绪，未接入页面 |

三套题库结构一致，统一导出 `learningPlan` + `questions` + `tagIndex`，Tag 即知识点唯一标识，`category` 区分 `core`（基础必学）/ `extension`（扩展挑战）。

---

## 六、测试体系

### 6.1 结构

```
tests/
├── setup.ts                  # jest-dom + localStorage/sessionStorage mock + msw 生命周期
├── test-utils.tsx
├── unit/                     # api / learningOrchestrator / practiceGrader / questionBank / tutorQuality
├── ai/                       # gradeByAI 防幻觉、promptBuilder、角色边界验证
├── components/               # 页面与服务模块导入测试
├── integration/              # 真实 DeepSeek 接口连通性测试（独立执行，见 6.2）
├── stress/                   # localStorage 大量读写、页面切换、大数据集性能
├── mocks/                    # msw handlers / server（SSE 与非流式 mock）
└── e2e/                      # Playwright 学习流程用例
```

msw 已在 `tests/setup.ts` 中全局启动（`server.listen` + `resetHandlers` + `close`），按 system prompt 内容分发 mock 响应，支持 SSE 分块流。

### 6.2 实测结果（2026-10-07）

**默认套件 `npm test`（11 个文件，不含 integration）**

| 指标 | 数值 |
|------|------|
| 用例总数 | 334 |
| 通过 | 332 |
| 失败 | 2 |

**真实接口套件 `npm run test:api`（1 个文件）**

| 指标 | 数值 |
|------|------|
| 用例总数 | 13 |
| 通过 | 13（全部通过，耗时 11.6s） |

> `tests/integration/` 已从默认套件中排除（`vitest.config.ts` 的 `exclude`），需显式执行 `npm run test:api`。原因：这些用例会真实调用 API 产生费用。独立配置 `vitest.api.config.ts` 使用 node 环境且不加载 `tests/setup.ts`，避免 msw 拦截真实请求。

**失败项（全部集中在 `tests/components/Pages.test.tsx` 的模块导入用例）**

| 用例 | 现象 |
|------|------|
| `Home 模块可正常导入` | 稳定失败。`Home.tsx` 依赖 recharts，模块图大，import 耗时 15–22.6s，超过用例设定的 15s 上限 |
| `Practice 模块可正常导入` | **偶发**失败。同一用例在低负载下耗时 94ms，高负载下升到 6.8–7.9s，超过 vitest 默认 5s 上限 |

> 这两项与模型迁移无关（`Home.tsx` / `Practice.tsx` 未被改动），是纯耗时型 flaky：机器负载高时必然失败。其余 12 条导入用例与服务模块断言全部通过。
>
> 真实接口用例（`tests/integration/api-real.test.ts`，13 条）在配置了有效 Key 时全部通过，会消耗真实额度。

### 6.3 已知测试缺口

| 缺口 | 现状 | 建议 |
|------|------|------|
| 组件交互测试缺失 | 现有组件测试仅验证「模块可导入」，未覆盖 Practice 答题提交、Tutor 流式问答、Profile 对话画像等交互 | 补 `@testing-library/user-event` 驱动的交互用例 |
| 真实接口用例消耗额度 | ✅ 已解决：已从默认套件排除，改由 `npm run test:api` 显式执行 |
| E2E 断言偏弱 | 9 条用例中多条仅断言「body 有内容」；登录用例使用错误密码 `123456`（真实为 `student123`）且失败被静默跳过 | 按用户旅程补齐「登录 → 画像 → 路径 → 练习 → 判分 → 评估 → 追问」完整闭环断言 |
| 覆盖率无门槛 | CI 未设置覆盖率阈值 | 在 CI 中加 `--coverage` + 阈值门禁 |
| Java / 数据库题库无测试 | `questionBank.test.ts` 仅覆盖 Python 题库 | 补充两套题库的数据完整性测试 |
| `Home` / `Practice` 导入用例不稳定 | 依赖 recharts，import 耗时贴近阈值，高负载下超时 | 拆分测试文件，或为这两个用例单独上调 timeout |
| 类型检查未通过 | ✅ 已解决：`tsc -b` 0 错误，`npm run build` 通过 |
| ESLint 未通过 | `npm run lint` 有 **42 errors** / 6 warnings（详见 7.5），CI lint job 会失败。B-0 第 1 批已完成（59→42） | 收窄剩余 31 处 any，再单独重构 set-state-in-effect / only-export-components |

---

## 七、注意事项

### 7.1 安全风险（必须处理）

- **API Key 配置方式**：Key 从环境变量 `VITE_DEEPSEEK_API_KEY` 读取，存放于 `.env.local`（匹配 `.gitignore` 的 `*.local`，不会被提交）。仓库内已不再有明文 Key。`.env.example` 是模板文件，不含真实 Key。**对外发布前请确认 `.env.local` 未被提交**。
- **注意 Vite 的环境变量机制**：`VITE_` 前缀的变量会被**内联进前端产物**，因此 Key 一定会暴露在浏览器里。这是纯前端直连大模型的固有局限，只适用于竞赛演示。生产环境应改为由自有后端代理转发并保管 Key。
- **认证为前端模拟**：用户表、密码、登录态全部在 `localStorage`，任何人都能在浏览器控制台读取或篡改。仅适用于竞赛演示，不可作为生产方案。
- **无后端与数据库**：所有数据存在浏览器本地，清除浏览器数据即丢失；多端不互通。

### 7.2 环境与代理

- 开发代理只在 `npm run dev` 下生效（`vite.config.ts` 的 `server.proxy`）。**`npm run preview` 与 `npm run build` 产物没有代理**，`/deepseek` 请求会 404，生产部署需自行配置反向代理，或改为直连后端。
- **模型名**：`VITE_DEEPSEEK_MODEL` 默认 `deepseek-flash`。该 Key 仅支持 `deepseek-flash` 与 `deepseek-v4-pro`，传入其他模型名会返回 400。
- 若改用推理型模型，注意其 `reasoning_content` 会消耗 `max_tokens`，`max_tokens` 过小会导致 `content` 为空字符串（正文为空）。

### 7.3 代码现状提示

- **Java / 数据库题库尚未接入**：两个文件实现了完整数据结构与工具函数，但 `Practice.tsx` 只从 `pythonQuestionBank` 取题。若要启用，需补充题库切换 UI 并将 `practiceGrader` 的题库来源参数化（当前 `practiceGrader` 直接 import Python 题库）。
- **待清理的临时文件**：仓库根目录存在 `temp_batch1-4.json`、`temp_db_*.cjs`、`temp_process*.json` 等一次性数据处理产物，以及 `learning-agent/dist/` 这个游离的构建输出目录；`scripts/tmp/` 是临时脚本与草稿目录，可整体删除。这些都不参与构建，建议提交前清理或加入 `.gitignore`。
- **`Home.tsx` 偏重**：recharts 图表使该模块 import 成本较高，测试中已暴露为超时问题。
- **性能**：`practiceGrader.submitAnswer` 每次提交都会全量重算模块进度与标签得分并写 `localStorage`，在结果量大时有明显开销（`tests/stress/` 已覆盖相关场景）。

### 7.4 代码检查现状

| 检查 | 状态 |
|------|------|
| `npx tsc -b` | ✅ 0 错误 |
| `npm run build` | ✅ 通过（3908 模块，产物 2.16 MB / gzip 709 KB） |
| `npm run lint` | ❌ 42 errors / 6 warnings（详见 7.5） |

### 7.5 ESLint 遗留问题（42 errors / 6 warnings）

`npm run lint` 与 CI 的 `lint` job 当前会失败。B-0 第 1 批（零行为风险项）已于 2026-10-07 完成，lint 从 **59 → 42 errors**。剩余分布：

| 规则 | 数量 | 主要位置 |
|------|---------|---------|
| `@typescript-eslint/no-explicit-any` | 31 | `multiAgentFramework.ts`(9)、`PageCacheContext.tsx`(6)、`StudentOverview.tsx`(4)、`Path/Profile/Resources`(5)、`FeedbackManage.tsx`(2)、`useDebounce.ts`(3) 等 |
| `react-hooks/set-state-in-effect` | 8 | `AuthContext.tsx`(134)、`Assessment.tsx`(80)、`Home.tsx`(167/279/405)、`FeedbackManage.tsx`(25)、`StudentOverview.tsx`(48)、`UserManage.tsx`(32) |
| `react-refresh/only-export-components` | 3 | `AuthContext.tsx`(250/257)、`PageCacheContext.tsx`(62) |
| `react-hooks/exhaustive-deps`（warn） | 6 | `App.tsx`、`Home.tsx`(2)、`Practice.tsx`、`StudentOverview.tsx`、`UserManage.tsx` |

**已修复（59 → 42）**：`no-empty` 6 处（空 `catch` 加注释，逻辑不变）、`no-unused-vars` 4 处（删除死代码）。

> `tests/` 目录下的 `no-explicit-any` **已由 `eslint.config.js` 中 `files: ['tests/**'] -> off` 的 override 覆盖**，不需要也不应在测试文件里加 `eslint-disable` 注释（反而会触发 `Unused eslint-disable directive` 告警）。

剩余 42 处中，`set-state-in-effect` 与 `only-export-components` 需重构认证初始化与 hook 导出方式，存在行为回归风险，建议单独一轮处理。完整治理任务卡见 `HANDOVER.md` §8.1 B-0。

---

## 八、更新记录

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-10-07 | — | **大模型迁移：MiniMax → DeepSeek**：API 层由 Anthropic 格式改为 OpenAI 兼容格式（`system` 进 messages、SSE 改解析 `choices[].delta.content`、思考内容改接 `reasoning_content` 并保留「思考中…」展示）；代理改为 `/deepseek` → `api.deepseek.com`；API Key 改为环境变量注入（`.env.local` + `.env.example`），仓库内不再有明文 Key；真实接口测试与 msw mock 同步迁移，并拆为独立 `npm run test:api`；修复 `javaQuestionBank.ts` 160 行缺失尾逗号导致的 159 个语法错误；清理 26 个类型错误，`tsc -b` 与 `npm run build` 均通过 |
| 2026-06-15 | — | **测试缺口补齐**：修复 `calculateModuleProgress` 纯简答模块 NaN、`gradeByAI` 多数字取值问题；新增 `assertScoreReasonable` / `gradeByAIVerified` 判分加固、`tutorQuality` 回答校验、页面/服务模块导入测试、GitHub Actions CI 与 husky pre-commit |
| 2026-06-08 | — | 新增登录模块、用户管理模块、意见反馈模块；建立测试框架（Vitest + Playwright） |
| 2026-06-01 | — | 新增数据库题库 `databaseQuestionBank.ts`（135 题，覆盖 9 大知识域，`fill` 题型自动判分）；题库更新与模块间关系完善 |
| 2026-05-25 | — | 学习路径阶段状态管理 + 交互流程重构；智能辅导模块优化 |
| 2026-05-18 | — | 智能辅导三轮优化：追问链、追问流程 v2（AI 自动判断上下文、追问回答回显原始问题）、历史管理与点踩重生成 |
| 2026-05-11 | — | 用户数据集中管理、学习画像测试问卷、页面缓存 |
| 2026-04-27 | — | 页面缓存、流式响应与 Markdown 渲染 |
| 2026-04-13 | v1.0 | 首次提交：资源生成功能 |

### 后续计划（按优先级）

1. **P0** 清理 59 个 ESLint 错误（见 7.5），让 CI `lint` job 通过。其中 `AuthContext` 的 effect 内 setState 需重构初始化方式，建议单独一轮。
2. **P1** 修复 `Pages.test.tsx` 中 `Home` / `Practice` 导入超时（拆分测试文件或上调 timeout）。
3. **P1** 补齐核心交互组件测试（Practice 答题提交 / Tutor 流式问答 / Profile 画像构建）。
4. **P1** E2E 按用户旅程补齐完整学习闭环断言，修正登录用例凭据。
5. **P2** 接入 Java / 数据库题库，为练习中心增加题库切换。
6. **P2** CI 增加覆盖率门槛；把 `test:api` 作为手动触发工作流加入 CI；清理临时文件。

---

## 九、文档维护约定

- 本文件为唯一权威文档。架构、命令、测试数据变更时**必须同步更新本文件**。
- `AGENTS.md` 仅保留为 AI 代理的入口指针，内容指向本文档。
- 临时脚本统一放 `scripts/tmp/`，不要散落在仓库根目录。
