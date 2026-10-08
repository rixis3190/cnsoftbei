# 评测方法说明（RAG + 质量漏斗）

> 适用范围：`src/embedding`、`src/rag`、`src/services/answerScorer.ts`、`src/services/qualityFunnel.ts`。
> 全部命令**默认离线、零 API 额度**；真实 LLM 评测必须手动触发。
>
> 这份文档是 `实施计划_细化版.md` 步骤 5（S5-6）的产出。
> README 属于受保护文件（本次改造期间不得改动），因此评测说明独立成文。

## 0. 一句话口径

| 指标 | 定义 | 门禁含义 | 当前状态 |
|---|---|---|---|
| 规则层通过率 | 无禁止项命中 且 要点覆盖率 ≥ 阈值 | 确定性，可阻断 | 已阻断（一直如此） |
| 语义层得分 | 0.55×余弦 + 0.45×要点覆盖率，禁止项硬否决 | 统计性，**当前只记录** | **默认关闭**（`SEMANTIC_LAYER_ENABLED=false`）；即使打开，Tutor 生产链路也不注入 `reference/scorer`（自由提问没有标准答案），语义层恒为 `skipped`；它只在评测链路与题库题上生效。影子模式开关默认 `true`，含义是「一旦被启用也只记录不拦截」 |
| 模型层评审 | LLM 打分 0~100，< 70 触发重生成 | 不确定，默认不阻塞 | 已启用（`MODEL_DEGRADE_IS_BLOCKING=false`；设为 `true` 时模型层降级会阻塞） |
| Recall@3 / MRR / NDCG@3 | 检索质量 | 确定性（检索是纯计算） | 有门禁（stem 类 ≥0.9） |
| 忠实度 | 被支撑断言句 / 总断言句 | **观测指标，不进门禁** | 只记录 |

**降级可观测性**：`runQualityFunnel` 返回 `layersRun`（跑了哪些层）与 `layersSkipped`（没跑哪些层），
并保证不变量 `layersRun ∪ layersSkipped = {rule, semantic, model}` 且两者不相交（有单测钉住）。

2026-10-08 起 **`eval-report.html` 已有「降级可观测（§1.3）」卡片**，含三项：
规则层否决率（禁止项命中）、覆盖率不达标率（< 60%）、检索无覆盖查询数（按生产 `RETRIEVAL_FLOOR` 判定 = L3 降级）。
数据来源：`test-results/golden-eval.json` 的 `summary.degradation`（**取自负样本轮**，见下）与
`test-results/rag-metrics.json` 的 `degradation`。

> ⚠️ 两个必须知道的口径细节：
> 1. **金标两格取自「负样本轮」**：`runGoldenEval` 对每个候选轮都会写同一个 `golden-eval.json`，
>    而 excellent 轮的两个计数**结构性恒为 0**（否决为 0 是构造保证、覆盖率不达标为 0 是校验器保证）。
>    因此只有负样本轮（候选 = poor 锚点）能反映真实拒答能力；其余探路调用一律 `persist=false`。
> 2. **模型层降级（L2）未接入本报告**：它发生在运行期评审链路，只在 `console.warn` 里可见。
>    报告里不会出现 L2 计数，不要误读为「L2 降级率为 0」。

## 1. 怎么跑

```powershell
npm run golden:build        # 由题库重新生成基准集
npm run golden:check        # 只校验：与生成器/题库不一致 → 退出码 1
npm run vectors:build       # 重新生成 ragChunks.json + ragVectors.json
npm run vectors:build -- --check   # 只校验产物与题库一致
npm run rag:queries         # 重新生成 RAG 查询集
npm run threshold:tune      # 阈值标定 → test-results/threshold-report.{json,md}
npm run threshold:tune -- --check   # 只比对已固化阈值（超出仅告警）
npm run eval:golden         # 基准集跑批（零额度）
npm run eval:rag            # 检索与忠实度指标
npm run eval:report         # 生成 test-results/eval-report.html
```

CI 对应 job：

- `test` job 跑 `npm run test:coverage`（含 `tests/eval/**`，零额度），并上传 `test-results/` 与 `coverage/`；
- `eval` job 依次跑 `golden:check` → `vectors:build --check` → `threshold:tune --check` →
  **`eval:golden` → `eval:rag`** → `eval:report`，并上传 `test-results/`。
  注意最后三步是必需的：`golden-eval.json` 与 `rag-metrics.json` 是**测试的副作用产物**，
  由 `test` job 写在它自己的工作区里，`eval` job 拿不到 —— 不自己跑一遍，
  生成的报告会缺掉基准集与检索两块内容（评审 MAJOR-4）。

## 2. 基准集的两层结构

| 层 | `referenceSource` | 来源 | 用途 |
|---|---|---|---|
| 金标层 | `sampleAnswer` | 题库里真实存在的 83 条简答题参考答案 | 阈值拟合、主要评测 |
| 合成层 | `synthesized` | 客观题「题干 + 正确答案 + 解析」合成，30 条 | 只进 smoke 集 |

**合成层不参与阈值拟合**：用合成答案拟合阈值会得到假结论（实施计划 T-1）。

### 2.1 标注现状（必须知道的事实）

2026-10-08 复核后：`meta.anchorSource = 'curated'`、`reviewedCount = 113`、
`meta.reviewedBy = 'ai-assisted-systematic-review'`。

- 要点：从「参考答案 + 题库解析」按**句子**抽取（先保护括号与列表序号，避免 `a=[1,2]`、
  `不可变对象(int` 这类碎片），超长句子在子句达标时才切分，单条 ≤20 字；
- 禁止项：按**归一化后的标签**（`normalizeTags`）取人工整理的常见误区表，再按与参考答案的
  词面重合度排序并剔除自相矛盾项。**注意 database 题库的原始标签是中文**（「SQL基础」等），
  不做归一化会命中 0 条候选、退化成占位项（2026-10-08 实测的 15 条占位项即由此产生）；
- 锚点：`excellent = 参考答案 + 解析`（长度不足时补说明句以维持单调性）、
  `fair = excellent 的较长前缀`、`poor = 参考答案短前缀 + 固定含糊表述（「细节记不清了」）`。

**为什么 poor 不用禁止项里的错误说法**：禁止项是硬否决（命中即 0 分），
若负样本自身就是禁止项，83 条负样本得分会恒为 0 —— 那只能证明否决规则能触发，
**不能检验语义阈值**，`negativeDiversity` 会退化为 1 且 `usable` 永远不通过。
所以负样本刻意不含错误说法原文，靠「覆盖不足 + 表述含糊」拿低分。

**当前仍未完成的**：人工抽检（`reviewedBy` 记录的是 AI 辅助系统化审校）。
在人工抽检确认前（`HANDOVER.md` §13 B-24 为 P0），本目录的数字可用于**流程验证**，
**不得对外引用**，`usable` 也会保持 `false` —— 这不是缺陷，是刻意的闸门。

### 2.2 覆盖率口径的一个历史缺陷（已修，必须知道）

`textMatch.pointCoverage` 对「归一化后变成空串的纯标号要点」（`>>`、`//`、`{}`、`==`…）
曾**无条件返回 1**（"空要点视为已覆盖"），导致：

- 单符号题上任何回答——**包括空回答**——覆盖率都是 100%，实测 `scoreAnswer('', '>>' 题).total === 100`；
- 规则层对这类题目空转，评测报告出现「完美的」分档。

修法：这类要点改为对**候选原文**做子串判定（包含才算覆盖）。修后实测：
空回答在全部 83 条金标上的最高分为 **0.00**，规则层逐条有序违例从 1 条降为 **0 条**。
回归守卫见 `tests/eval/runGoldenEval.test.ts` 的「空回答不得白拿分数」用例。

## 3. 阈值是怎么来的

`npm run threshold:tune` 做的是：

1. 正样本 = 每条金标条目的 `excellent` 锚点；负样本 = `poor` 锚点（`fair` 永不参与）；
2. 逐阈值 0~100（步长 1）算 TPR / FPR / 精确率 / 召回 / F1 / Youden J；
3. 取 Youden J **平坦区中心**（J ≥ maxJ − 0.02 的区间中心），避免选到尖峰（G-12）；
4. LOO 交叉验证（留一条）输出折间稳定性；
5. 输出 `usable` 判定：Youden J < 0.3、正负中位数重叠、负样本多样性不足、
   **最强负样本 ≥ 阈值**、**最弱正样本 < 阈值**、锚点未人工复核 —— 任一命中即 `usable=false`。

最后三条是复核时新加的：只看中位数可分是不够的（一条满分负样本就能推翻整个阈值），
必须逐条确认「阈值确实把两类分开了」；而 `humanReviewed` 是**实质性闸门**，
不能因为「数据看起来变好了」就翻成 true。

实测（curated 锚点，83+83，2026-10-08）：最优阈值 **77**，J = 1.00，TPR = 1.00，FPR = 0.00，
平台区宽度 44，LOO 83 折准确率 1.00、**稳定折占比 97.6%**（2 折的阈值落在 ±0.02 外）；
**最强负样本 60.54 < 77 ≤ 最弱正样本 100**，负样本得分唯一值 68 种、无一条被硬否决。
`usable = false`（原因：**人工抽检未完成**）→ 语义层保持影子模式。

> 关于「稳定折占比不是 100%」：`optimalThreshold` 取的是 J ≥ maxJ−0.02 的平台区**中心**，
> 而中心位置由「第二强负样本」的位置决定 —— 留一条样本后中心可能平移几分。
> 因此**不要用 ±2 这种硬容差去卡已固化阈值**，要断言「阈值仍落在平台区内」
> （`tests/unit/tuneThreshold.test.ts` 已按此口径实现）。

**J = 1.00 仍然需要解释**，不能单独当成绩：
修订前负样本是同一句「不知道。」，J=1.00 是负样本同质造成的假象（唯一值只有 1 种）；
修订后负样本来自 83 个不同题目、得分覆盖面广，J=1.00 才有意义。
**引用阈值时必须同时引用「最强负样本 < 阈值 ≤ 最弱正样本」这条**，而不是只引用 J。

## 4. 检索指标口径

- `Recall@k = |retrieved ∩ gold| / |gold|`，分母是金标块数；
- `MRR = 1/|gold| × Σ 1/rank_i`，`rank_i` 取首个命中位，未命中记 0；
- `NDCG@k`：二值相关度，`IDCG` 用理想排序；
- 查询集分三类，**不可合并成一个数字**：
  - `stem`（83 条）：题干即查询，与块文本高度重合 → 天然虚高，只作「管道是否接通」的健康检查；
  - `paraphrase`（22 条）：手写口语化改写，金标集合是「该标签下全部块」，
    因此 `Recall@3` 的上限是 `min(1, 3/金标块数)`；
  - `overview`（43 条）：概览型提问，目标是 `tag-overview` 块。

实测（2026-10-08 口径修正后）：stem 0.976 / paraphrase 0.333 / overview 0.349（Recall@3）；
MRR 分别为 0.924 / 0.210 / 0.271。

**其中 paraphrase 分两栏，不可混读**：

| 口径 | Recall@3 | 含义 |
|---|---|---|
| 带 `tagHint`（标签路由） | 0.333 | 候选集被限定在该标签内 → 接近结构性上限，**不携带排序信息** |
| **不带 `tagHint`（= 生产路径）** | **0.130** | 真实的检索质量。Tutor 调 `retrieveForQuestion(q, { topK: 3 })` 不传 hint |

生产路径只有 0.130 是**已知弱点**，不能靠带 hint 的 0.333 掩盖。
下一步的改进方向（尚未实施）：在 UI 已有「当前知识点」上下文时把 tag 作为 hint 传下去，
把 0.130 拉向 0.333 —— 这才是 tag 过滤真正的价值场景。

> **口径变更记录**：paraphrase 的金标集合原先按 `chunk.tags[0]` 过滤，
> 而检索侧的 tag 过滤是 `chunk.tags.some(...)`（任一标签命中）。两者不一致会导致
> 「能被召回的多标签块不算命中」，指标被系统性低估。现已改为同一口径
> （`some(t => c.tags.includes(t))`），金标集合变大 → Recall@3 由 0.345 变为 0.333。
> 修正后 NDCG@3 = 1.0，说明「top-3 全在金标集合内」，指标回到可解释状态。

### 4.1 忠实度的已知局限

忠实度用「单句 vs 片段」的余弦相似度近似蕴含判断，因此：

- 正确回答的忠实度**也到不了 1.0**（实测约 0.8）；
- 切句只按中文句号/问号/分号，粗粒度是已知局限。

结论：忠实度**只当观测指标**，不进 CI 门禁（S4-R8）。若将来要进门禁，
需要引入 NLI 之类的蕴含模型。

## 5. 降级链与混沌演练

| 级别 | 触发 | 行为 | 对应测试 |
|---|---|---|---|
| L1 语义降级 | `scoreAnswer` 抛异常 | 只记 warn，不阻塞 | `qualityFunnel.test.ts` |
| L2 模型降级 | 评审超时/解析失败/非数字 | `modelDegraded=true`，不阻塞 | `qualityFunnel.test.ts` |
| L3 RAG 降级 | 索引缺失/解码失败/检索异常 | 不注入上下文 | `vectorsArtifacts.test.ts`（D-1/D-2） |
| L4 纯规则 | 无 provider / 全部层异常 | 等价于改造前行为 | `answerScorer.test.ts` |

开关全在 `src/config/evalConfig.ts`，回滚优先级最高（改 1 行配置，不动逻辑）。

## 6. 体积留痕（RAG 落地后，计划 §9.5 R9）

`npm run build && npm run measure:size` 实测（2026-10-08）：

| 口径 | 数值 | 说明 |
|---|---|---|
| 首屏合计 | 31 个 chunk，raw 825.8 KB / **gzip 280.0 KB** | 与 B-19 代码分割后的 280.1 KB 持平（RAG 未进首屏） |
| RAG 向量 + 检索 chunk（`retriever-*.js`） | raw 350.18 kB / **gzip 90.68 kB** | **不在 index.html 的 modulepreload 里** = 动态 import 生效，首次提问才加载 |
| 最大单文件 | `MarkdownRenderer-*.js` 763.0 KB | 与本次改造无关（既有依赖） |

结论：RAG 产物以 90.68 kB gzip 的懒加载 chunk 交付，首屏体积零回归。

## 7. 常见坑

1. **不要在运行期重算 IDF**：必须用 `ragVectors.json` 里落盘的 `idf`，否则阈值口径失真。
2. **不要绕过量化**：阈值脚本与线上跑批必须都走 `decodeVectors`，否则「标定通过率」与「线上通过率」会差好几个点。
3. **改了题库就要 `golden:build` + `vectors:build`**，否则 `golden:check` / `vectors:check` 会红。
4. **报告里的 `usable=false` 不是失败**，是「现在还不该拿这个数字去 gating」的诚实提示。
5. **Windows + `core.autocrlf=true` 会让 `vectors:check` 假失败**：仓库里的产物 blob 是 LF，
   checkout 后被展开成 CRLF，而脚本用 `readFileSync(file,'utf8')` 逐字符比对，必然不等。
   已用 `.gitattributes` 对 4 个构建期产物声明 `-text` 锁定（`ragChunks` / `ragVectors` /
   `ragBuildReport` / `goldenSet`）。**代价**：这 4 个文件不再有换行符归一化，
   因此**禁止用会写入 CRLF 的编辑器保存它们**（一旦存成 CRLF 并提交，`--check` 会在所有平台失败）。
6. **改阈值后要同步三处**：`src/config/qualityThresholds.ts`（常量 + provenance）、
   本文档 §3、`HANDOVER.md` §9；`tuneThreshold.test.ts` 会断言「常量落在平台区内」。
7. **`runGoldenEval` 的落盘是有副作用的**：它覆写 `golden-eval.json`，而报告降级卡片读该文件。
   只有「负样本轮」才应 `persist=true`，其余探路调用必须 `persist=false`。
