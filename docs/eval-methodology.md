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
| 语义层得分 | 0.55×余弦 + 0.45×要点覆盖率，禁止项硬否决 | 统计性，**当前只记录** | 影子模式（`SEMANTIC_SHADOW_MODE=true`） |
| 模型层评审 | LLM 打分 0~100，< 70 触发重生成 | 不确定，默认不阻塞 | 已启用（`MODEL_DEGRADE_IS_BLOCKING=false`） |
| Recall@3 / MRR / NDCG@3 | 检索质量 | 确定性（检索是纯计算） | 有门禁（stem 类 ≥0.9） |
| 忠实度 | 被支撑断言句 / 总断言句 | **观测指标，不进门禁** | 只记录 |

## 1. 怎么跑

```powershell
npm run golden:build        # 由题库重新生成基准集
npm run golden:check        # 只校验：题库漂移 / 未审校条目被改 → 退出码 1
npm run vectors:build       # 重新生成 ragChunks.json + ragVectors.json
npm run vectors:build -- --check   # 只校验产物与题库一致
npm run rag:queries         # 重新生成 RAG 查询集
npm run threshold:tune      # 阈值标定 → test-results/threshold-report.{json,md}
npm run threshold:tune -- --check   # 只比对已固化阈值（超出仅告警）
npm run eval:golden         # 基准集跑批（零额度）
npm run eval:rag            # 检索与忠实度指标
npm run eval:report         # 生成 test-results/eval-report.html
```

CI 对应 job：`test`（`test:coverage`）→ `eval`（golden:check / vectors:check / threshold:check / report）。

## 2. 基准集的两层结构

| 层 | `referenceSource` | 来源 | 用途 |
|---|---|---|---|
| 金标层 | `sampleAnswer` | 题库里真实存在的 83 条简答题参考答案 | 阈值拟合、主要评测 |
| 合成层 | `synthesized` | 客观题「题干 + 正确答案 + 解析」合成，30 条 | 只进 smoke 集 |

**合成层不参与阈值拟合**：用合成答案拟合阈值会得到假结论（实施计划 T-1）。

### 2.1 标注现状（必须知道的事实）

`meta.anchorSource = 'template'`、`reviewedCount = 0`：要点/禁止项/锚点目前是
**脚本派生初稿**（`scripts/gen-golden-dataset.ts`），**尚未人工审校**。

- 要点：从「参考答案 + 题库解析」按中文标点切分，单条 ≤20 字；
- 禁止项：按 (题库, 标签) 取人工整理的常见误区表（见脚本内 `MISCONCEPTIONS`）；
- 锚点：`excellent = 参考答案 + 解析`，`fair = 前两个要点`，`poor = 固定一句「记不太清，抱歉。」`。

因为负样本锚点是**同一句话**，负样本不含真实区分信息，所以
`threshold:tune` 会输出 `usable = false` 并建议保持影子模式。
**人工审校完成（计划 S1-4）之前，本目录任何数字都不能写进简历。**

## 3. 阈值是怎么来的

`npm run threshold:tune` 做的是：

1. 正样本 = 每条金标条目的 `excellent` 锚点；负样本 = `poor` 锚点（`fair` 永不参与）；
2. 逐阈值 0~100（步长 1）算 TPR / FPR / 精确率 / 召回 / F1 / Youden J；
3. 取 Youden J **平坦区中心**（J ≥ maxJ − 0.02 的区间中心），避免选到尖峰（G-12）；
4. LOO 交叉验证（留一条）输出折间稳定性；
5. 输出 `usable` 判定：Youden J < 0.3、正负中位数重叠、负样本多样性不足、锚点未人工审校 —— 任一命中即 `usable=false`。

实测（模板锚点，83+83）：最优阈值 **61**，J = 1.00，TPR = 1.00，FPR = 0.00，LOO 83 折准确率 1.00，
但 `usable=false`（锚点未审校 + 负样本单一）。

**J = 1.00 本身是可疑信号**，不是成绩。

## 4. 检索指标口径

- `Recall@k = |retrieved ∩ gold| / |gold|`，分母是金标块数；
- `MRR = 1/|gold| × Σ 1/rank_i`，`rank_i` 取首个命中位，未命中记 0；
- `NDCG@k`：二值相关度，`IDCG` 用理想排序；
- 查询集分三类，**不可合并成一个数字**：
  - `stem`（83 条）：题干即查询，与块文本高度重合 → 天然虚高，只作「管道是否接通」的健康检查；
  - `paraphrase`（22 条）：手写口语化改写，金标集合是「该标签下全部块」，
    因此 `Recall@3` 的上限是 `min(1, 3/金标块数)`；
  - `overview`（43 条）：概览型提问，目标是 `tag-overview` 块。

实测：stem 0.976 / paraphrase 0.345 / overview 0.372（Recall@3）。

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

## 6. 常见坑

1. **不要在运行期重算 IDF**：必须用 `ragVectors.json` 里落盘的 `idf`，否则阈值口径失真。
2. **不要绕过量化**：阈值脚本与线上跑批必须都走 `decodeVectors`，否则「标定通过率」与「线上通过率」会差好几个点。
3. **改了题库就要 `golden:build` + `vectors:build`**，否则 `golden:check` / `vectors:check` 会红。
4. **报告里的 `usable=false` 不是失败**，是「现在还不该拿这个数字去 gating」的诚实提示。
