# JobLens

[![CI](https://github.com/kinghy949/joblens/actions/workflows/ci.yml/badge.svg)](https://github.com/kinghy949/joblens/actions/workflows/ci.yml)

一个面向求职者的 AI 简历优化工作台 —— 5 个 Agent 协作，把"一份简历 + 一段 JD"在一分钟内拆解为**评分 / 改写 / 面试问题**三件套。

> 🚧 V1 工程化已就绪，待部署到公网

## 是什么

打开 `/analyze`，粘贴 JD + 上传简历，拿到：

- 📊 **5 维度匹配雷达图** — 技术 / 经验 / 项目相关性 / 沟通 / 亮点稀缺度
- 🎯 **关键词覆盖热力** — JD 关键词在简历里的命中分类（强/弱/缺失）
- ✍️ **逐句改写建议** — 每条 bullet 的原文 vs 优化版，附 STAR 化理由 + 新命中关键词
- 🎤 **针对性面试问题** — 3-5 道按"技术深度 / 空缺探测 / 项目细节 / 软技能" 分类的开放式追问
- 🔗 **24 小时可分享链接** — 服务器只在你主动点"生成分享链接"时才存简历内容

## 演示路径

V1 内置 `?demo=1` 安全模式：完全不调真实 LLM，直接回放冻结的示例分析（5.6 秒走完全流程），适合在面试现场或网络不稳的场合演示。

```
http://localhost:3000/?demo=1          ← 落地页带 demo 入口
http://localhost:3000/analyze?demo=1    ← 跳过填表，直接体验
```

真实分析路径（你自己的简历）：

```
http://localhost:3000/analyze
```

PDF / Markdown / 纯文本简历都行，最大 5 MB，**解析后即丢，不入库不落盘**。

## 多 Agent 编排（5 Agent · 三阶段 DAG）

```
阶段 1 (并行)                  阶段 2 (单独)               阶段 3 (并行)
┌──────────────────┐
│ JDParserAgent    │ ─┐
└──────────────────┘  │                               ┌──────────────────┐
                      ├─→ MatchScorerAgent  ─────┬───→│ RewriterAgent    │ ─┐
┌──────────────────┐  │                          │    └──────────────────┘  │
│ ResumeAnalystAgnt│ ─┘                          │    ┌──────────────────┐  ├─→ 结果页
└──────────────────┘                             └───→│ InterviewerAgent │ ─┘
                                                      └──────────────────┘
```

- **阶段 1**：JD 解析 + 简历分析 并行（Phase 1 收尾约 36 秒）
- **阶段 2**：5 维度匹配评分（基于阶段 1，约 29 秒）
- **阶段 3**：改写建议 + 面试问题 并行；Rewriter 用 `selectRewriteTargets` 算法按"缺指标/弱关键词/未植入 required 词/弱动词"打分预筛 top-8

服务端走 SSE，客户端订阅 `agent-start / agent-done / phase-complete / final` 事件，4 个 Agent 面板按阶段实时点亮。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 · React 19 · TypeScript |
| 样式 | Tailwind v3.4 · shadcn/ui · Stitch 设计系统 |
| AI SDK | Vercel AI SDK 4 + `@ai-sdk/openai-compatible` + `@ai-sdk/anthropic` |
| 默认模型 | NVIDIA NIM · Llama 3.1 8B（light）+ Llama 3.3 70B（heavy） |
| 备选模型 | Anthropic Claude Haiku / Sonnet（`?provider=claude` 切换） |
| Schema 校验 | Zod 3（5 Agent input/output 全覆盖） |
| 文件解析 | unpdf（现代 PDF）+ utf-8 decoder |
| 存储 | Postgres 16（仅分享链接，24h 过期）+ Redis 7（rate limit）|
| 部署 | Docker Compose · Caddy（自动 Let's Encrypt 证书） |
| 流式 | SSE (Server-Sent Events) 全链路 |
| 测试 | Vitest 单元测试 + 5 Agent acceptance harness + eval 框架 |
| CI | GitHub Actions（typecheck + lint + vitest + build）|

## 隐私

- 上传文件**仅在内存解析**，不落盘、不入库、不写日志（`pino` 已配 redact）
- 真实 LLM 调用通过 HTTPS 发到 NIM / Anthropic（业界标准）
- 分析结果默认只存在你的浏览器 `sessionStorage`
- 主动点"生成分享链接"才会落 Postgres，24 小时后由 cron 容器自动删除
- 详见 [`/privacy`](app/privacy/page.tsx)

## 本地开发

最小路径（不需要 Docker，不需要后端服务）：

```bash
git clone https://github.com/kinghy949/joblens.git && cd joblens
pnpm install
cp .env.example .env             # 填 NVIDIA_API_KEY
pnpm dev
```

打开 `http://localhost:3000` 即可，`?demo=1` 路径完全离线可用。

完整路径（含 Postgres + Redis，启用分享链接 + Rate limit）：

```bash
docker compose -f docker-compose.dev.yml up -d   # 起 pg + redis
pnpm dev
```

详见 [`docs/dev-setup.md`](docs/dev-setup.md)。

## 部署到 VPS

仓库已含完整生产配置：

- `Dockerfile`（多阶段 standalone build，最终 ~37MB）
- `docker-compose.yml`（caddy + next + postgres + redis + **cron** + **backup**）
- `Caddyfile`（SSE-friendly `flush_interval -1`）
- `db/init.sql`（首次启动自动建表）

部署到一台干净的 2C4G VPS（Ubuntu/Debian + Docker）：

```bash
git clone https://github.com/kinghy949/joblens.git && cd joblens
cp .env.example .env && $EDITOR .env Caddyfile   # 填密钥 + 改域名
docker compose up -d --build
```

完整 runbook：[`docs/deployment.md`](docs/deployment.md)。

## API

| 路由 | 方法 | 说明 | 限流 |
|---|---|---|---|
| `/api/analyze` | POST | SSE 流式分析（5 Agent DAG） | 10/h(real) · 200/h(demo) |
| `/api/upload` | POST | 简历文件解析为文本 | 30/h |
| `/api/result` | POST | 把分析结果固化为分享链接 | 5/h |
| `/api/result/[id]` | GET | 取回分享链接内容 | 120/min |

每个响应都带 `X-RateLimit-Limit / Remaining / Reset` 头；触限返回 429 + `Retry-After`。

## 文档

| 文件 | 内容 |
|---|---|
| [`docs/design.md`](docs/design.md) | 产品蓝图 / 用户旅程 / 三个关键页面线框图 / V1 范围 vs V2 留白 |
| [`docs/architecture.md`](docs/architecture.md) | 分层架构 / 三阶段 DAG / 共享上下文 / SSE 流式协议 / 部署拓扑 |
| [`docs/schemas.md`](docs/schemas.md) | 全部 Agent Zod schema + AgentRegistry + Rewriter 预筛算法 |
| [`docs/prompts.md`](docs/prompts.md) | 5 个 Agent system prompt + 通用框架 + 迭代规则 |
| [`docs/deployment.md`](docs/deployment.md) | Docker Compose 完整方案 + Runbook + 备份 + 安全 checklist |
| [`docs/dev-setup.md`](docs/dev-setup.md) | 本地开发 3 步上手 + 脚本 cheat-sheet |
| [`docs/risks.md`](docs/risks.md) | 18 项已识别风险 + 应对策略 + 跟踪记录 |
| [`docs/spike-streaming-results.md`](docs/spike-streaming-results.md) | NIM-Llama vs Claude 流式行为实测数据 |
| [`fixtures/demo-jd.md`](fixtures/demo-jd.md) | 内置示例 JD（高级后端 + LLM 方向）|
| [`fixtures/demo-resume.md`](fixtures/demo-resume.md) | 内置示例简历（故意埋的可改写痛点） |
| [`fixtures/golden-result.json`](fixtures/golden-result.json) | demo 模式回放用的冻结结果（5 Agent 完整产出） |

## 自动化与质量门

```bash
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm test          # 24 vitest cases (schemas + parse-resume)
pnpm build         # next build (Turbopack)
pnpm eval          # 5 Agent × 3 次回归测试 + 汇总表
```

GitHub Actions CI 每次 push 自动跑 typecheck + lint + test + build。

## 状态

| 里程碑 | 状态 |
|---|---|
| 设计阶段（产品 + 架构 + Schema + Prompt + 部署） | ✅ |
| Week 1 — 项目骨架 + 单 Agent 跑通主流程 | ✅ |
| Week 2 — 5 Agent + 编排器 + SSE + 结果页可视化 | ✅ |
| 真实文件上传链路（unpdf）| ✅ |
| 分享链接（Postgres 持久化 + 24h 过期）| ✅ |
| Eval 框架 + 回归测试 | ✅ |
| 生产部署配置（compose + Caddyfile + cron + backup） | ✅ |
| Rate limit (Redis fixed-window) | ✅ |
| 部署到公网 VPS | ⏳ |
| 30 秒 demo 视频 | ⏳ |
| Provider 切换 UI 真接 Claude（需 ANTHROPIC_API_KEY） | ⏳ |
| PDF 导出 V2 | — |

## License

MIT
