# R1 Spike 结果：双 Provider 流式行为实测

**日期**：2026-05-28
**目的**：决定 Llama 模式下是否需要"双通道（narration + JSON）"兜底，
以保住"四面板边输出边显示"的核心 demo 卖点。
**TL;DR**：**不需要兜底**。NIM-Llama 在 `streamObject` 下就是真增量流式。

---

## 测试方法

`scripts/spike-streaming.ts` 对同一段 JD 文本测三种模式：
1. `streamText` — 纯文本流式
2. `streamObject` — 结构化 JSON 流式（带 Zod schema）
3. `dualChannel` — 一次 prompt 中要求模型先输出 `<narration>` 段再输出 `<json>` 段

度量：首个 chunk 延迟（`firstChunk`）、总耗时、chunk 数、累计字节。

判定标准：`chunks > 3` 视为"真增量"。

---

## Llama 3.3 70B (via NVIDIA NIM) 结果

| 模式 | firstChunk | total | chunks | bytes | 真增量？ |
|---|---|---|---|---|---|
| streamText | 1338ms | 2189ms | 36 | 58 | ✅ |
| **streamObject** | **2630ms** | **6555ms** | **124** | **672** | ✅✅✅ |
| dualChannel | 2937ms | 6685ms | 319 | 747 | ✅（但 tag 不可靠） |

**关键发现：**

1. **`streamObject` 在 NIM-Llama 上是真增量的**。124 个 chunk 在 6.5 秒内陆续到达，
   首个 chunk 2.6s 就出现。这意味着前端能直接拿到 `partial` JSON 对象，
   边收边渲染面板内容。
2. `streamText` 更快（首字节 1.3s）但只能给纯文本，不能直接驱动结构化 UI。
3. `dualChannel` 也能流式，但 Llama 没严格按 `<narration>...</narration>`
   tag 输出（生成了纯 JSON），所以正则提取失败。强约束 prompt 才能稳定。

---

## 决策

✅ **采纳 `streamObject` 作为 V1 主路径**，弃用双通道作为强制要求。

理由：
- 真增量已验证，"四面板跳字" demo 效果直接可达
- 一次模型调用即可拿到结构化结果 + 流式中间态，简单且省 token
- 双通道增加 prompt 复杂度且 tag 解析不稳

**UI 实现策略：**
- 客户端在收到每个 `partial` 对象后，根据已填充字段做"打字机式"展示
- 例如 `partial.hard_skills` 数组每多一项就在面板里 append 一行
- 面板的"narration 区域"可以由前端从 partial 字段衍生展示（"已识别 5 个硬技能：Python, FastAPI, ..."），不再需要模型专门产出 narration 段

**Claude 模式延后再验证**（无 key）。基于 Anthropic SDK 行为可预期同样支持增量；
拿到 key 后跑一次确认即可，不影响主路径。

---

## 后续 follow-up

- [ ] 拿到 ANTHROPIC_API_KEY 后跑 `pnpm tsx scripts/spike-streaming.ts claude` 对照
- [ ] 在编排器 + Agent 实现里使用 `streamObject`（见 #4/#5 任务）
- [ ] 更新 `docs/architecture.md` 第二节 5："流式渲染策略"段，把双通道降级为"可选保留"
- [ ] 更新 `docs/prompts.md`：移除针对 Llama 的双通道模板，回归单 JSON 输出
