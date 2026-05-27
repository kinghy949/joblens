# JobLens · 系统架构设计

> 本文档描述 V1 的系统架构：模块划分、数据流、关键序列、技术选型理由。
> 配合 `docs/design.md`（产品蓝图）一起读。

---

## 一、架构总览

```mermaid
flowchart TB
    subgraph Client["浏览器 (Next.js App Router)"]
        UI[UI 组件层<br/>shadcn/ui + Tailwind]
        SSE[SSE 客户端<br/>Vercel AI SDK useChat/useObject]
        Viz[可视化层<br/>Recharts + diff-viewer]
    end

    subgraph Edge["Vercel Edge / Node Runtime"]
        API[/API Routes<br/>app/api/*/]
        Orch[Agent 编排器<br/>orchestrator.ts]
        Parse[简历解析器<br/>pdf-parse / Claude PDF]
    end

    subgraph Agents["Agent 层 (无状态函数)"]
        A1[JDParserAgent]
        A2[ResumeAnalystAgent]
        A3[MatchScorerAgent]
        A4[RewriterAgent]
        A5[InterviewerAgent]
    end

    subgraph External["外部服务"]
        Claude[Anthropic API<br/>Sonnet 4.6 / Haiku 4.5<br/>+ prompt caching]
        Supa[(Supabase<br/>Postgres + Storage)]
    end

    UI --> SSE
    SSE -->|POST /api/analyze| API
    API --> Parse
    API --> Orch
    Orch --> A1 & A2 & A3 & A4 & A5
    A1 & A2 & A3 & A4 & A5 -->|stream chunks| Claude
    API -->|可选: 持久化分享链接| Supa
    API -.->|流式 token| SSE
    SSE --> Viz
```

**核心原则：**
- **无状态 API**：每次分析请求是独立的，不依赖会话状态；只有"分享链接"功能才落库
- **Agent 即函数**：Agent 是纯函数 `(input, ctx) → AsyncIterable<chunk>`，不持有状态
- **流式优先**：从模型 → 编排器 → API → 浏览器，全链路流式，不做中间缓冲

---

## 二、分层职责

### 1. 客户端 (Next.js App Router · React Server Components)

| 子层 | 职责 | 关键文件 |
|---|---|---|
| 页面路由 | `/`、`/analyze`、`/result/[id]` 三个核心路由 | `app/(routes)/*` |
| UI 组件 | shadcn/ui 二次封装的设计系统 | `components/ui/*` |
| 流式接收 | 监听 SSE，把多路 Agent token 路由到对应面板 | `lib/client/stream.ts` |
| 可视化 | 雷达图、diff、热力图等纯展示组件 | `components/viz/*` |
| 状态管理 | Zustand（轻量）或纯 React state；不引入 Redux | `lib/client/store.ts` |

**为什么不用 Server Actions 做主流程？** Server Actions 不天然支持多路并行流式，自己拼麻烦；走 Route Handler + Vercel AI SDK `streamObject` 更直接。

### 2. API 层 (Edge Runtime 优先)

| 路由 | 方法 | 用途 |
|---|---|---|
| `/api/analyze` | POST | 主入口：接收 JD + 简历，返回多路流式 |
| `/api/upload` | POST | 简历 PDF 上传（multipart） |
| `/api/result/[id]` | GET | 加载已分享的结果 |
| `/api/result` | POST | 把当前结果固化为分享链接（写库） |

`/api/analyze` 跑 Node Runtime（因为 pdf-parse 需要 Node API）；其他可以跑 Edge。

### 3. Agent 编排器 (orchestrator.ts)

**编排策略：分层并行 (DAG)**

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orchestrator
    participant JD as JDParserAgent
    participant RA as ResumeAnalystAgent
    participant MS as MatchScorerAgent
    participant RW as RewriterAgent
    participant IV as InterviewerAgent

    C->>O: POST /api/analyze {jd, resume}
    activate O
    par 第一层 (并行)
        O->>JD: parse(jd)
        O->>RA: analyze(resume)
    end
    JD-->>O: jd_struct
    RA-->>O: resume_struct
    O-->>C: SSE: stage="phase1_done"

    par 第二层 (并行)
        O->>MS: score(jd_struct, resume_struct)
        O->>RW: rewrite(resume_struct, jd_struct)
        O->>IV: interview(resume_struct, jd_struct)
    end
    MS-->>O: scores
    RW-->>O: rewrites
    IV-->>O: questions
    O-->>C: SSE: stage="done" + full_result
    deactivate O
```

**为什么不用 LangGraph / CrewAI？**
- DAG 简单到 50 行代码搞定，引入框架反而增加心智负担
- 面试时要能逐行讲清编排逻辑，自写更可控
- Vercel AI SDK 已经处理了流式 + 工具调用 + JSON schema 三件最难的事

### 4. Agent 实现层

每个 Agent 是一个独立模块，形态高度一致：

```ts
// lib/agents/jd-parser.ts
export const JDParserAgent = {
  name: 'jd-parser',
  model: 'claude-haiku-4-5',
  inputSchema: z.object({ jd_text: z.string() }),
  outputSchema: JDStructSchema,  // 见 docs/schemas.md
  systemPrompt: '...',           // 长 prompt，启用 prompt caching
  run: async (input, ctx) => streamObject({...})
}
```

每个 Agent：
- 输入/输出有 Zod schema，编译期类型安全
- system prompt 走 prompt caching（每次调用省 70%+ token 成本）
- 失败自动重试 1 次（指数退避）；2 次仍失败则在 UI 上标红，但**不阻塞其他 Agent**
- 单 Agent 超时 30s 强制取消

### 5. 模型层 (Anthropic API)

**模型选择策略：**

| Agent | 模型 | 理由 |
|---|---|---|
| JDParserAgent | Haiku 4.5 | 任务结构化、文本短，性价比最高 |
| ResumeAnalystAgent | Sonnet 4.6 | 需要识别"亮点 vs 弱项"，需要判断力 |
| MatchScorerAgent | Sonnet 4.6 | 多维度推理 |
| RewriterAgent | Sonnet 4.6 | 创作质量决定 demo 观感 |
| InterviewerAgent | Sonnet 4.6 | 需要从弱项反推问题，需要判断力 |

**Prompt Caching 策略：**
- 每个 Agent 的 system prompt + few-shot 示例放在 cache 段（>1024 tokens 才命中）
- 用户的 JD/简历放在 cache 段之后（每次都新）
- 估算：冷启动一次完整分析 ~$0.04，缓存命中后 ~$0.012

---

## 三、共享上下文对象 (AnalysisContext)

所有 Agent 共享一个结构化的上下文对象，**而不是把全部原文丢给每个 Agent**。这是设计的关键。

```ts
type AnalysisContext = {
  // 输入快照（不可变）
  input: {
    jd_text: string
    resume_text: string
    locale: 'zh' | 'en'
  }

  // 第一层产出
  jd_struct?: JDStruct          // 由 JDParserAgent 写入
  resume_struct?: ResumeStruct  // 由 ResumeAnalystAgent 写入

  // 第二层产出
  scores?: MatchScores
  rewrites?: Rewrite[]
  questions?: InterviewQuestion[]

  // 元信息
  trace_id: string
  started_at: number
  agent_timings: Record<string, { start: number; end?: number; status: 'pending'|'running'|'done'|'error' }>
}
```

每个 Agent 声明它**读**什么字段、**写**什么字段，编排器据此构建 DAG 并验证依赖。

---

## 四、流式协议

客户端 ↔ 服务端走 **SSE (Server-Sent Events)**，复用 Vercel AI SDK 的 `streamText` / `streamObject`。

**事件格式（自定义包装）：**

```
event: agent-start
data: { "agent": "jd-parser", "ts": 1234567 }

event: agent-chunk
data: { "agent": "jd-parser", "partial": { "hard_skills": ["Python"] } }

event: agent-done
data: { "agent": "jd-parser", "result": {...}, "duration_ms": 1820 }

event: stage-complete
data: { "stage": "phase1" }

event: error
data: { "agent": "rewriter", "code": "TIMEOUT", "message": "..." }

event: final
data: { "context": {...} }
```

客户端用一个 reducer 把这些事件聚合成完整 `AnalysisContext`，驱动 UI。

---

## 五、数据模型 (Supabase / Postgres)

V1 只有"分享链接"一个写库场景，schema 极简：

```sql
create table shared_results (
  id          text primary key,           -- nanoid, URL 友好
  context     jsonb not null,             -- 完整 AnalysisContext 快照
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '24 hours',
  view_count  int default 0
);

create index on shared_results (expires_at);
```

定时任务（Vercel Cron / Supabase pg_cron）每小时清理过期数据，落实"24h 后删除"承诺。

**简历 PDF 不入库**：上传后只在内存里跑解析，解析完即丢；只有结构化后的文本（脱敏可控）才可能进 `shared_results`。

---

## 六、目录结构

```
joblens/
├── app/
│   ├── (routes)/
│   │   ├── page.tsx              # 落地页
│   │   ├── analyze/page.tsx      # 输入 + 分析中
│   │   └── result/[id]/page.tsx  # 结果页（分享链接）
│   └── api/
│       ├── analyze/route.ts
│       ├── upload/route.ts
│       └── result/[id]/route.ts
├── components/
│   ├── ui/                       # shadcn 基础组件
│   ├── viz/                      # 雷达图 / diff / 热力图
│   ├── agent-panel.tsx           # 分析中的单个 Agent 面板
│   └── result/                   # 结果页各 section
├── lib/
│   ├── agents/
│   │   ├── jd-parser.ts
│   │   ├── resume-analyst.ts
│   │   ├── match-scorer.ts
│   │   ├── rewriter.ts
│   │   ├── interviewer.ts
│   │   └── index.ts              # 注册表
│   ├── orchestrator.ts           # DAG 编排
│   ├── schemas.ts                # 所有 Zod schema
│   ├── prompts/                  # 每个 Agent 的 prompt 模板
│   ├── parse-resume.ts           # PDF/MD → text
│   ├── client/                   # 客户端工具
│   └── server/                   # 服务端工具（含 Supabase client）
├── fixtures/
│   ├── demo-resume.md
│   └── demo-jd.md
├── docs/
│   ├── design.md
│   ├── architecture.md           # ← 本文档
│   └── schemas.md                # 输出 schema 详表
└── ...
```

---

## 七、部署拓扑

```
              ┌─────────────────────────────┐
              │   joblens.xxx (自有域名)     │
              │   ↓ DNS / Cloudflare         │
              └─────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────────────┐
              │   Vercel (Edge + Functions) │
              │   - Next.js 15 App Router   │
              │   - Edge Runtime: /api/result/*
              │   - Node Runtime: /api/analyze (pdf-parse)
              └─────────────────────────────┘
                  │                        │
                  ▼                        ▼
        ┌──────────────────┐    ┌────────────────────┐
        │ Anthropic API     │    │ Supabase            │
        │ - Sonnet 4.6     │    │ - Postgres (shares) │
        │ - Haiku 4.5      │    │ - Cron (cleanup)    │
        │ - Prompt caching │    │                     │
        └──────────────────┘    └────────────────────┘
```

**为什么 Vercel？**
- Next.js 15 一键部署，Edge + Node 混合 runtime 原生支持
- Preview Deployment：每个 PR 一个 URL，面试时可直接发链接
- 域名绑定 5 分钟

**为什么 Supabase？**
- Postgres + 自带 Auth + Storage + Cron 一站式
- 免费额度足够覆盖 demo 期流量
- 后续要做账号系统时无缝接入

---

## 八、性能 / 成本目标

| 指标 | 目标 |
|---|---|
| 冷启动首字节延迟 (TTFB) | < 800ms |
| 首个 Agent 开始流式输出 | < 1.5s |
| 全部 5 Agent 完成 | ≤ 15s (P50)，≤ 25s (P95) |
| 一次完整分析 API 成本 (无缓存) | < $0.05 |
| 一次完整分析 API 成本 (缓存命中) | < $0.015 |
| Vercel 月度费用 (Demo 期 ≤ 1000 次/月) | $0 (Hobby) |
| Supabase 月度费用 (Demo 期) | $0 (Free tier) |

---

## 九、可观测性

V1 不上专业 APM，但要有最小可见性：

| 数据 | 收集方式 | 用途 |
|---|---|---|
| 每个 Agent 的 duration / tokens / cost | 服务端 `console.log` + Vercel Logs | 调优 |
| 整体分析成功率 / 失败率 | 同上 | 监控 |
| 用户行为 (开始分析 / 完成 / 导出 / 分享) | Vercel Analytics (免费) | 漏斗 |
| Prompt cache 命中率 | 从 Anthropic API 响应头读，记日志 | 验证成本估算 |

V2 可以接 OpenTelemetry → Grafana Cloud / Highlight.io。

---

## 十、错误处理与降级

| 场景 | 处理 |
|---|---|
| 单个 Agent 超时 (>30s) | 取消该 Agent，UI 该面板标红"分析超时"，其他面板继续；最终结果页该 section 显示"本次未生成"，提供"重试该项"按钮 |
| 单个 Agent 输出 schema 校验失败 | 自动重试 1 次（强化 prompt 中的"必须输出 JSON"）；仍失败则降级为纯文本展示 |
| Anthropic API 全局不可用 | API 返回 503 + 友好文案；不熔断重试（避免雪崩） |
| PDF 解析失败 | 提示用户改为粘贴文本；保留"用示例简历"作为兜底 |
| 用户上传超大文件 (>5MB) | 客户端预检拦截 |
| Supabase 不可用 | 分享链接功能降级为"复制 JSON 到剪贴板"，主流程不受影响 |

---

## 十一、安全与隐私

| 维度 | 措施 |
|---|---|
| 简历内容传输 | HTTPS only；不写入服务端日志（结构化日志显式 redact `resume_text` 字段） |
| 简历内容存储 | 默认**不入库**；只有用户主动点"生成分享链接"才落 `shared_results` |
| 数据保留 | 分享链接 24h 自动过期 + 删除（Cron） |
| API 滥用防护 | IP-based rate limit (Upstash Redis / Vercel KV)：10 次/小时/IP |
| Prompt injection | 用户输入用明确分隔符包裹 (`<jd>...</jd>`)；system prompt 加防御指令；输出校验剔除可疑指令 |
| 第三方 (Anthropic) 隐私 | 首页明确告知"内容会发送给 Anthropic 用于推理，不会用于训练"（引用 Anthropic 政策） |
| 密钥管理 | `ANTHROPIC_API_KEY` / Supabase keys 走 Vercel Env Vars；不进仓库 |

---

## 十二、依赖一览（V1 锁定版本）

| 类别 | 包 | 版本 |
|---|---|---|
| 框架 | next | ^15 |
| UI | react | ^19 |
| 样式 | tailwindcss | ^4 |
| 组件 | @radix-ui/* (via shadcn) | latest |
| AI SDK | ai (Vercel AI SDK) | ^4 |
| AI Provider | @ai-sdk/anthropic | latest |
| Schema | zod | ^3 |
| 状态 | zustand | ^5 |
| 可视化 | recharts | ^2 |
| Diff | react-diff-viewer-continued | latest |
| PDF | pdf-parse | latest |
| DB | @supabase/supabase-js | ^2 |
| ID | nanoid | ^5 |
| 工具 | clsx, tailwind-merge | latest |

---

## 十三、开放问题（待后续确认）

- [ ] 主色调最终敲定（冷蓝 vs 墨绿 vs 暖橙）
- [ ] 是否需要 i18n 框架（V1 只有中文，可能直接硬编码字符串）
- [ ] 是否做 Server-Side Rendering 缓存（落地页静态化 vs 动态）
- [ ] 简历 PDF 解析失败率高时是否引入 Claude 自身的 PDF 输入能力（API 直接读 PDF）
- [ ] Rate limit 用 Upstash Redis 还是 Vercel KV
