# JobLens · Agent 输入/输出 Schema 详表

> 所有 Agent 的输入、输出、共享上下文都用 Zod 定义。这份文档是 **类型契约的单一事实源**。
> 实现时落在 `lib/schemas.ts`，导出给 Agent / 编排器 / 客户端 reducer 共用。

---

## 〇、设计约束（双 Provider 兼容）

为了让 Llama 3.3 70B 和 Claude 都能稳定产出合规 JSON，所有 schema 遵守以下硬约束：

1. **扁平优先**：嵌套不超过 2 层；数组里的对象字段不超过 6 个
2. **无 union / discriminated union**：用 `enum` 替代（Llama JSON mode 对 union 支持不稳定）
3. **所有数值字段给区间**：用 `.min().max()`，Zod 在 prompt 中可序列化为约束
4. **枚举字段穷举所有值**：不用开放字符串
5. **可选字段尽量少**：能给默认值就给默认值（`.default()`），减少模型决策负担
6. **字符串长度上限**：所有字符串字段加 `.max()`，避免模型生成长篇大论拖慢流式

---

## 一、共享基础类型

```ts
// lib/schemas/common.ts
import { z } from 'zod'

export const Locale = z.enum(['zh', 'en'])
export const Tier = z.enum(['light', 'heavy'])

export const Severity = z.enum(['low', 'medium', 'high'])
export const Impact = z.enum(['minor', 'moderate', 'major']) // 改写影响力

export const SkillLevel = z.enum(['required', 'preferred', 'bonus'])

export const Grade = z.enum(['S', 'A', 'B', 'C', 'D'])
// 评分阈值: S>=90, A>=80, B>=70, C>=60, D<60

export const AgentStatus = z.enum(['pending', 'running', 'done', 'error'])
```

---

## 二、Agent 1: JDParserAgent

**职责**：把 JD 原文拆解为结构化要求 + 关键词。

### 输入

```ts
export const JDParserInput = z.object({
  jd_text: z.string().min(50).max(8000),
  locale: Locale.default('zh'),
})
```

### 输出

```ts
export const JDStruct = z.object({
  role_title: z.string().max(80),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'staff', 'lead']),

  hard_skills: z.array(z.object({
    name: z.string().max(40),
    level: SkillLevel,
  })).max(20),

  soft_skills: z.array(z.string().max(40)).max(10),

  // 模型从字里行间读出的隐藏要求（"能独立带团队"等）
  hidden_requirements: z.array(z.object({
    requirement: z.string().max(120),
    evidence: z.string().max(120),  // JD 原文里支撑这个推断的片段
  })).max(8),

  // 用于关键词覆盖热力图
  keywords: z.array(z.string().max(30)).min(5).max(25),

  // 一句话总结这个岗位最看重什么
  one_liner: z.string().max(80),
})

export type JDStruct = z.infer<typeof JDStruct>
```

---

## 三、Agent 2: ResumeAnalystAgent

**职责**：把简历原文解析为结构化经历 + 提取亮点/弱项。

### 输入

```ts
export const ResumeAnalystInput = z.object({
  resume_text: z.string().min(100).max(15000),
  locale: Locale.default('zh'),
})
```

### 输出

```ts
const ResumeBullet = z.object({
  id: z.string(),                    // bullet 唯一 id (供改写 Agent 引用)
  company: z.string().max(60),
  role: z.string().max(60),
  text: z.string().max(280),          // 原 bullet 内容
  has_metrics: z.boolean(),           // 是否含量化指标
})

export const ResumeStruct = z.object({
  candidate_name: z.string().max(40).optional(),
  experience_years: z.number().min(0).max(50),
  domain_tags: z.array(z.string().max(30)).max(8),  // 后端/前端/算法/...

  bullets: z.array(ResumeBullet).min(1).max(40),

  highlights: z.array(z.object({
    point: z.string().max(120),
    why_strong: z.string().max(120),
  })).max(6),

  weaknesses: z.array(z.object({
    point: z.string().max(120),
    severity: Severity,
  })).max(6),

  // 简历整体的技术关键词，用于和 JD keywords 做交集
  resume_keywords: z.array(z.string().max(30)).min(5).max(40),
})

export type ResumeStruct = z.infer<typeof ResumeStruct>
```

---

## 四、Agent 3: MatchScorerAgent

**职责**：基于 `JDStruct` + `ResumeStruct` 输出多维度匹配评分。

### 输入

```ts
export const MatchScorerInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
})
```

### 输出

```ts
export const MatchScores = z.object({
  overall_score: z.number().min(0).max(100),
  grade: Grade,

  dim_scores: z.object({
    tech: z.number().min(0).max(100),           // 技术匹配
    experience: z.number().min(0).max(100),     // 经验年限/深度
    project: z.number().min(0).max(100),        // 项目相关性
    communication: z.number().min(0).max(100),  // 简历表达/沟通信号
    uniqueness: z.number().min(0).max(100),     // 亮点稀缺度
  }),

  // 一句话评语，用于结果页 hero 区
  summary: z.string().max(60),

  // JD keywords × 简历命中
  keyword_coverage: z.array(z.object({
    keyword: z.string().max(30),
    hit: z.enum(['strong', 'weak', 'missing']),
    evidence: z.string().max(80),  // 在简历里的支撑片段或"无"
  })).max(25),
})

export type MatchScores = z.infer<typeof MatchScores>
```

**评分锚点（写进 prompt）：**
- 90+：硬技能全覆盖 + 经验对口 + 有量化亮点
- 80-89：硬技能覆盖 80% + 经验对口 + 表达良好
- 70-79：硬技能覆盖 60-80% + 有 1-2 项明显短板
- 60-69：明显能力差距，但有可弥补的亮点
- <60：方向性不匹配

---

## 五、Agent 4: RewriterAgent

**职责**：针对简历每一条 bullet 给出改写建议。

### 输入

```ts
export const RewriterInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
  // 只对最有改写价值的 bullets 改（由编排器预筛 top N，避免改 30 条）
  target_bullet_ids: z.array(z.string()).max(10),
})
```

### 编排器预筛规则（target_bullet_ids 怎么选）

编排器在调用 RewriterAgent 之前，用以下确定性规则从 `ResumeStruct.bullets` 中选出最值得改写的 top N（默认 N=8）：

```ts
function selectRewriteTargets(
  bullets: ResumeBullet[],
  jd: JDStruct,
  scores: MatchScores
): string[] {
  const jdRequiredKeywords = new Set(
    jd.hard_skills.filter(s => s.level === 'required').map(s => s.name.toLowerCase())
  )
  const missingOrWeak = new Set(
    scores.keyword_coverage
      .filter(k => k.hit !== 'strong')
      .map(k => k.keyword.toLowerCase())
  )

  // 每条 bullet 打分（高分优先改）
  const scored = bullets.map(b => {
    let score = 0
    if (!b.has_metrics) score += 3                          // 缺指标：高优先级
    const text = b.text.toLowerCase()
    for (const kw of missingOrWeak) {
      if (text.includes(kw)) score += 2                     // 可以挂上缺失关键词
    }
    for (const kw of jdRequiredKeywords) {
      if (!text.includes(kw)) score += 1                    // 应植入但还没出现
    }
    if (/(参与|协助|帮助|负责)/.test(b.text)) score += 1     // 弱动词
    return { id: b.id, score }
  })

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.id)
}
```

注意：这个预筛**依赖 MatchScorer 的输出**，因此 RewriterAgent 的依赖图需调整为依赖 `match-scorer`，而不是仅依赖第一层两个 Agent。见 `AgentRegistry` 更新版本。

### 输出

```ts
export const Rewrite = z.object({
  bullet_id: z.string(),
  original: z.string().max(280),
  rewritten: z.string().max(280),
  reason: z.string().max(180),       // 为什么这样改
  impact: Impact,                     // 对整体匹配度的影响力
  hit_keywords: z.array(z.string().max(30)).max(5),  // 改写后新命中的 JD 关键词
})

export const RewriterOutput = z.object({
  rewrites: z.array(Rewrite).max(10),
})

export type Rewrite = z.infer<typeof Rewrite>
```

**展示时按 `impact` 排序（major → minor）。**

---

## 六、Agent 5: InterviewerAgent

**职责**：基于弱项 + JD 关键要求，生成针对性面试问题。

### 输入

```ts
export const InterviewerInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
  scores: MatchScores,  // 用 weak dimension 和 missing keywords 反推追问
})
```

### 输出

```ts
export const InterviewQuestion = z.object({
  question: z.string().max(160),
  probe_point: z.string().max(100),         // 这道题考察什么
  category: z.enum([
    'technical_depth',     // 技术深度追问
    'gap_probe',           // 探测简历空缺
    'soft_skill',          // 软技能落地
    'project_detail',      // 项目细节追问
    'scenario',            // 场景模拟
  ]),
  suggested_angle: z.string().max(200),     // 候选人回答时的建议切入角度
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

export const InterviewerOutput = z.object({
  questions: z.array(InterviewQuestion).min(3).max(5),
})

export type InterviewQuestion = z.infer<typeof InterviewQuestion>
```

---

## 七、共享上下文 AnalysisContext

编排器把所有 Agent 的输入/输出聚合在一个对象里，全链路流转。

```ts
export const AnalysisContext = z.object({
  schema_version: z.string().default('1.0.0'),  // 严格匹配 SCHEMA_VERSION 常量
  trace_id: z.string(),
  started_at: z.number(),  // ms epoch

  input: z.object({
    jd_text: z.string(),
    resume_text: z.string(),
    locale: Locale,
    provider: z.enum(['llama', 'claude']).default('llama'),
    is_demo: z.boolean().default(false),  // demo 模式 (?demo=1) 短路真实 LLM
  }),

  // 第一层产出
  jd_struct: JDStruct.optional(),
  resume_struct: ResumeStruct.optional(),

  // 第二层产出
  scores: MatchScores.optional(),
  rewrites: z.array(Rewrite).optional(),
  questions: z.array(InterviewQuestion).optional(),

  // 每个 Agent 的运行元数据
  agent_runs: z.record(
    z.string(),  // agent name
    z.object({
      status: AgentStatus,
      started_at: z.number(),
      ended_at: z.number().optional(),
      tokens_in: z.number().optional(),
      tokens_out: z.number().optional(),
      cost_usd: z.number().optional(),
      cache_hit: z.boolean().optional(),
      error: z.string().optional(),
    })
  ),
})

export type AnalysisContext = z.infer<typeof AnalysisContext>
```

---

## 八、SSE 事件 schema（客户端 reducer 用）

```ts
export const SSEEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agent-start'),
    agent: z.string(),
    ts: z.number(),
  }),
  z.object({
    type: z.literal('agent-chunk'),
    agent: z.string(),
    partial: z.unknown(),  // 流式中间态，不强约束
  }),
  z.object({
    type: z.literal('agent-done'),
    agent: z.string(),
    result: z.unknown(),
    duration_ms: z.number(),
    tokens_in: z.number().optional(),
    tokens_out: z.number().optional(),
  }),
  z.object({
    type: z.literal('stage-complete'),
    stage: z.enum(['phase1', 'phase2', 'all']),
  }),
  z.object({
    type: z.literal('error'),
    agent: z.string(),
    code: z.enum(['TIMEOUT', 'SCHEMA_INVALID', 'API_ERROR', 'RATE_LIMIT']),
    message: z.string(),
  }),
  z.object({
    type: z.literal('final'),
    context: AnalysisContext,
  }),
])
```

> 注：这里用了 `discriminatedUnion`，但只在**服务端→客户端**方向，不发给模型；模型输出严格走前面的扁平 schema。

---

## 九、Agent 依赖关系（编排器读这个）

```ts
export const AgentRegistry = {
  'jd-parser': {
    inputSchema: JDParserInput,
    outputSchema: JDStruct,
    reads: ['input.jd_text'],
    writes: ['jd_struct'],
    deps: [],
    tier: 'light' as const,
  },
  'resume-analyst': {
    inputSchema: ResumeAnalystInput,
    outputSchema: ResumeStruct,
    reads: ['input.resume_text'],
    writes: ['resume_struct'],
    deps: [],
    tier: 'heavy' as const,
  },
  'match-scorer': {
    inputSchema: MatchScorerInput,
    outputSchema: MatchScores,
    reads: ['jd_struct', 'resume_struct'],
    writes: ['scores'],
    deps: ['jd-parser', 'resume-analyst'],
    tier: 'heavy' as const,
  },
  'rewriter': {
    inputSchema: RewriterInput,
    outputSchema: RewriterOutput,
    reads: ['jd_struct', 'resume_struct', 'scores'],   // 依赖 scores 做预筛
    writes: ['rewrites'],
    deps: ['jd-parser', 'resume-analyst', 'match-scorer'],
    tier: 'heavy' as const,
  },
  'interviewer': {
    inputSchema: InterviewerInput,
    outputSchema: InterviewerOutput,
    reads: ['jd_struct', 'resume_struct', 'scores'],
    writes: ['questions'],
    deps: ['jd-parser', 'resume-analyst', 'match-scorer'],
    tier: 'heavy' as const,
  },
}
```

编排器据此自动构建 DAG，无需手写"先调谁、后调谁"。

---

## 十、版本约定

每次 schema 变更（哪怕加一个 optional 字段）都 bump 版本号：

```ts
export const SCHEMA_VERSION = '1.0.0'
```

写入 `AnalysisContext.schema_version`，让分享链接的结果在 schema 演进后还能正确渲染（或显示"该结果由旧版生成"）。

---

## 十一、面向 Llama 的 prompt 加固

由于 Llama 3.3 70B 没有原生 tool use，每个 Agent 的 prompt 必须包含以下结构：

```
你是一个专业的 ___ 分析师。

[任务描述]

[输入]
<input>
{user_input}
</input>

[输出要求]
你必须只输出一个合法的 JSON 对象，严格符合以下 JSON Schema：

{json_schema_dump}

[硬性约束]
- 只输出 JSON，不要有任何解释性文字、不要用 markdown 代码块包裹
- 所有字符串字段不能超过 schema 中标注的最大长度
- 所有枚举字段必须使用 schema 中给出的精确取值
- 数组长度严格在 min/max 之间
- 数值字段严格在 min/max 之间

[示例]
{one_few_shot_example}
```

`json_schema_dump` 用 `zod-to-json-schema` 库自动生成；`one_few_shot_example` 手工准备 1 个高质量示例。

Claude 模式下不需要这种加固，直接用 `streamObject({ schema })` 即可。
