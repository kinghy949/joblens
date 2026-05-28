# JobLens · 风险与应对清单

> 设计阶段审查识别的风险，按严重性分级。每项含应对策略和跟踪 issue（若有）。
> 状态：✅ 已处理 / 🔄 跟踪中 / ⏳ Week N 才做

---

## 🔴 阻塞级

### R1. Llama 流式 JSON 可能不"边出边显示"
**问题**：`streamObject` 依赖模型渐进式输出 JSON；Llama 在 NIM 上可能等整段 JSON 生成完才一次性返回，"四面板跳字" demo 卖点失效。
**应对**：~~双通道输出~~ → **2026-05-28 spike 已验证 NIM-Llama 的 `streamObject` 真增量**（124 chunks / 6.5s）。直接用 `streamObject`，前端订阅 `partialObjectStream` 渲染。
**跟踪**：`docs/spike-streaming-results.md`
**状态**：✅ **风险解除**

### R2. NVIDIA NIM 真实免费额度未核实
**问题**：文档假设"~1000 次/月"是估算，实际 RPM 限制、月配额、商用条款都未确认。开发开始才发现限流 = 重做方案。
**应对**：~~Week 1 开工前注册 NIM 账号，跑一次压测，回填真实数字~~ → **2026-05-28 确认：NIM 个人版无总量限制，仅 RPM 限制**。Week 1 期间多次 10× 测试 + 真实 e2e 调用从未触限，对 demo 期容量足够。已回填 `docs/architecture.md` 第二节 5 + 第八节。
**状态**：✅ **风险解除**

---

## 🟡 风险级

### R3. Llama 中文 + 严格 JSON 双重约束的命中率未知
**问题**：6 条 schema 约束已写到 prompt，但缺自动化验证。
**应对**：Week 1 验收标准里加 "fixtures 跑 10 次，schema 通过率 ≥ 8/10 (Llama) / 10/10 (Claude)"。
**跟踪**：已写入 Issue W1-4、W1-5 的"验收"段
**状态**：✅ 已纳入验收

### R4. RewriterAgent 预筛规则原先未定义
**问题**："由编排器预筛 top N bullets" 没说怎么选。
**应对**：在 `docs/schemas.md` 第五节给出确定性算法（缺指标 +3 / 命中弱关键词 +2 / 应植入但未出现 +1 / 弱动词 +1），并把 RewriterAgent 依赖图调整为依赖 `match-scorer`。DAG 变三阶段。
**状态**：✅ 已落

### R5. Tailwind v4 生态风险
**问题**：v4 是新引擎、新配置体系，shadcn 主线仍在 v3。
**应对**：依赖表已锁 `tailwindcss ^3.4`，Issue W1-1 也注明用 v3 init。
**状态**：✅ 已锁

### R6. pdf-parse 已停止维护
**问题**：对部分中文简历 PDF 抽取质量差。
**应对**：依赖表首选 `unpdf`（现代实现），`pdf-parse` 降为备选。Week 1 用 demo 简历 PDF 实测后定。
**状态**：✅ 默认换 unpdf

### R7. 落地页 30 秒 demo 视频流程未规划
**问题**：Week 6 才做来不及。
**应对**：Week 4 末安排"demo 彩排"日，录视频自托管到 `/public/demo.mp4`。
**跟踪**：Roadmap (Week 4 任务清单更新)
**状态**：⏳ Week 4

---

## 🔵 不一致 / 文档质量

### R8. AnalysisContext 缺 schema_version 字段
**应对**：已补 `schema_version: z.string().default('1.0.0')`；同步加 `is_demo: boolean`。
**状态**：✅

### R9. architecture.md Edge runtime 残留
**应对**：第二节 2 已改为"统一 Node Runtime"，并解释原因。
**状态**：✅

### R10. README 的 4 个 Agent vs 5 个 Agent 不一致
**应对**：README 改为明确的三阶段 5-Agent DAG 图，并注明"分析中页 4 块面板"。
**状态**：✅

### R11. Cloudflare 橙云警告埋得太深
**应对**：第七节"域名与 TLS"已加粗强调"必须 DNS-only / Proxy=Off"。
**状态**：✅

---

## ⚪ 待改进

### R12. 缺自动化 eval 框架
**应对**：架构第九节已加 `scripts/eval.ts` 设计；W2-Eval Issue 跟踪实现。
**状态**：✅ 设计已落，⏳ Week 2 实现

### R13. 没有 CI
**应对**：W1-CI Issue 跟踪。最小 CI：PR 触发 typecheck + lint + eval。
**状态**：🔄 跟踪中

### R14. 分享链接过期 UX 未设计
**应对**：W3-Expired-UX Issue 跟踪。`/result/[id]` 查不到记录时显示专属 410 页（"链接已过期，但你可以再分析一份"）。
**状态**：🔄 跟踪中

### R15. 速率限制未拆分（读写同限）
**应对**：架构第二节 2 已拆——`/api/analyze` 严限、`/api/result/[id]` 宽松。
**状态**：✅

### R16. 简历日志脱敏机制未明确
**应对**：架构第十一节给出 `pino redact` 具体配置路径。
**状态**：✅

### R17. Issue #7 中 PDF 解析路径表述错误
**应对**：Issue #7 描述已修正——所有文件统一用 FormData 上传，服务器解析。
**状态**：✅

### R18. 缺少"demo 安全模式"（面试现场保险绳）
**应对**：架构第二节 3 新增 `?demo=1` 短路真实 LLM 调用，固定返回 `fixtures/golden-result.json` + 伪流式延时。`AnalysisContext.input.is_demo` 标记。
**跟踪**：W1-Demo-Mode Issue
**状态**：✅ 设计已落

---

## 演化日志

- **2026-05-27**：初版风险审查，识别 18 项并全部处理 / 跟踪。
