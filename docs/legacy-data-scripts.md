# 根目录 temp_* 文件说明（S6-7）

> **结论：保留，不要删。** 它们是题库与 RAG 语料的**溯源依据** ——
> `src/data/*.ts` 里的题库就是由这些一次性脚本从原始数据解析出来的。

| 文件 | 作用 | 产物 |
|---|---|---|
| `temp_process.cjs` | Python/Java 题库解析（含 `tagMap` / `moduleMap` 归一化表） | `temp_processed.json` |
| `temp_db_parse2.cjs` | database 题库原始文本解析 | `temp_db_processed.json` |
| `temp_db_process.cjs` | database 题库加工（题型/标签/阶段划分） | `temp_db_processed.json` |
| `temp_generate.cjs` | 题目批量生成辅助脚本 | `temp_batch*.json` |
| `temp_processed.json` | Python/Java 题库解析产物（中间态） | 被 `src/data/*QuestionBank.ts` 消费后固化 |
| `temp_db_raw.txt` | database 题库原始文本 | 解析输入 |
| `temp_db_processed.json` | database 题库解析产物 | 同上 |
| `temp_batch1..4.json` | 分批生成的题目草稿 | 同上 |

## 为什么留着

1. **溯源**：题库被质疑「题目从哪来」时，只有这几个文件能回答；
2. **重建**：`src/data/tagMap.ts` 的标签映射就是照着 `temp_process.cjs` 的
   `tagMap` 做的，删掉脚本等于丢掉映射的推导过程；
3. 它们不进 bundle（不在 `src/` 下，也不被任何 `src/` 文件 import），只占仓库体积。

## 规则

- **不要删**；也不要把它们移进 `scripts/`，那会暗示「这是构建链的一环」（它们不是，
  当前 `vectors:build` / `golden:build` 都不依赖它们）。
- 如果将来要归档，先 `git mv` 到 `archive/` 并在本表登记，不要直接删除。
- 新增同类一次性脚本时，请放进 `scripts/tmp/`（可整体清理的目录），不要往根目录扔。

## 相关

- 评测方法与指标口径见 [eval-methodology.md](./eval-methodology.md)。
