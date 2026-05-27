# JobLens

一个面向求职者的 AI 简历优化工作台 —— 多 Agent 协作，把"一份简历 + 一个 JD"快速拆解为可执行的优化建议。

> 🚧 V1 开发中，目标 2026-07 初上线 demo。

## 是什么

粘贴一段 JD，上传一份简历，30 秒内得到：
- 📊 **匹配度雷达图** —— 技术 / 经验 / 项目相关性 / 沟通信号 / 亮点稀缺度
- ✍️ **逐句改写 diff** —— 每条 bullet 原文 vs 优化版的红绿对照
- 🎯 **关键词覆盖热力** —— JD 关键词在简历里的命中情况
- 🎤 **模拟面试官提问** —— 基于你的简历最可能被追问的 3-5 个问题，附考察点

## 设计阶段交付清单

V1 开发开始前已完成的设计文档（点击查看）：

| 文档 | 内容 | 状态 |
|---|---|---|
| [`docs/design.md`](docs/design.md) | 产品蓝图：定位 / 用户旅程 / 三个关键页面线框图 / V1 范围 vs V2 留白 | ✅ |
| [`docs/architecture.md`](docs/architecture.md) | 系统架构：分层 / 三阶段 DAG / 共享上下文 / 双通道流式协议 / 部署拓扑 | ✅ |
| [`docs/schemas.md`](docs/schemas.md) | 全部 Agent 的 Zod schema + AgentRegistry + Rewriter 预筛规则 + Llama JSON 加固模板 | ✅ |
| [`docs/prompts.md`](docs/prompts.md) | 5 个 Agent 的 system prompt 草稿 + 通用框架 + 迭代规则 | ✅ |
| [`docs/deployment.md`](docs/deployment.md) | Docker Compose 部署方案：服务拓扑 / Caddyfile / Dockerfile / Runbook / 备份 | ✅ |
| [`docs/risks.md`](docs/risks.md) | 已识别风险清单 + 应对策略 + 跟踪 issue | ✅ |
| [`fixtures/demo-jd.md`](fixtures/demo-jd.md) | 内置示例 JD（高级后端 + LLM 应用方向） | ✅ |
| [`fixtures/demo-resume.md`](fixtures/demo-resume.md) | 内置示例简历（有意设计的可改写痛点） | ✅ |

## 多 Agent 编排（5 Agent · 三阶段 DAG）

```
阶段 1 (并行)                  阶段 2 (单独)              阶段 3 (并行)
┌──────────────────┐
│ JDParserAgent    │ ─┐
└──────────────────┘  │                              ┌──────────────────┐
                      ├──→ MatchScorerAgent  ────┬──→│ RewriterAgent    │ ─┐
┌──────────────────┐  │                          │   └──────────────────┘  │
│ ResumeAnalystAgnt│ ─┘                          │   ┌──────────────────┐  ├──→ [结果页]
└──────────────────┘                             └──→│ InterviewerAgent │ ─┘
                                                     └──────────────────┘
```

- **阶段 1**：JD 解析 + 简历分析 并行
- **阶段 2**：匹配评分（基于阶段 1 输出）
- **阶段 3**：改写建议 + 面试问题 并行（前者还会基于评分做预筛）

分析中页面显示 4 个面板（Rewriter 和 Interviewer 同期出现），UI 体感"一片接一片亮起来"。

## 技术栈

- **前端**: Next.js 15 · TypeScript · Tailwind · shadcn/ui
- **流式**: Vercel AI SDK (SSE 多路并行)
- **模型层（双 Provider）**:
  - 默认 **NVIDIA NIM** + Llama 3.3 70B（OpenAI 兼容接口，demo 零成本）
  - 备选 **Anthropic Claude** Sonnet 4.6 / Haiku 4.5（高质量对照，URL `?provider=claude` 切换）
- **存储**: Postgres 16（仅"分享链接"用） + Redis 7（rate limit）
- **可视化**: Recharts · react-diff-viewer
- **部署**: 自托管 Docker Compose（Caddy + Next + Postgres + Redis + cron + backup）

## 状态

| 里程碑 | 状态 |
|---|---|
| 设计阶段（产品 + 架构 + Schema + Prompt + 部署） | ✅ |
| Week 1 — 项目骨架 + 单 Agent 跑通主流程 | ⏳ |
| Week 2 — 多 Agent 编排骨架 + 流式 | — |
| Week 3 — 可视化（雷达 / 热力 / diff） | — |
| Week 4 — 模拟面试官 + 打磨 | — |
| Week 5-6 — Buffer / 上线物料 / 部署到 VPS | — |

## License

MIT
