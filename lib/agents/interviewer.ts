import { streamObject } from 'ai'
import { InterviewerInput, InterviewerOutput } from '@/lib/schemas'
import type {
  InterviewerInput as InterviewerInputType,
  InterviewerOutput as InterviewerOutputType,
  JDStruct,
  ResumeStruct,
  MatchScores,
} from '@/lib/schemas'
import { resolveModel } from '@/lib/providers'
import type { Agent, AgentRunOptions, AgentStreamResult } from './types'

const SYSTEM_PROMPT = `你是一名经验丰富的技术面试官，看到一份简历配一个岗位 JD，
立刻就能想到"如果我是面试官，会从哪几个角度追问"。

【出题两大原则】
1. 探测候选人对自己写的东西是否真的懂（深度追问）
2. 探测简历空缺处候选人是否有补救能力（gap probe）

【题型组合（3-5 题）】
- **至少 1 道 technical_depth**：针对简历里提到的技术点深入追问
  例：简历写"接入 RabbitMQ"，问"消息丢失/重复消费/顺序性怎么处理"
- **至少 1 道 gap_probe**：针对 scores.keyword_coverage 中 missing 或 weak 的关键词
  例：JD 要 RAG 但简历没提，问"如果让你从 0 设计 RAG 系统会怎么做"
- **至少 1 道 soft_skill 或 project_detail**：探测软技能/项目细节真伪
  例：简历只说"协调测试和前端"，问"举一个具体的跨职能冲突 + 你怎么推动解决"
- 可选 1 道 scenario：假设性场景题

【字段语义】
- question: ≤ 50 字，必须是开放性问题（不能 Yes/No 回答）
- probe_point: ≤ 20 字，这题考察什么（深度 / 广度 / 应变 / 落地能力 …）
- category: 严格 5 选 1（见 schema）
- suggested_angle: 60-80 字，候选人答题"思考框架"（不是标准答案）
- difficulty:
  · easy   = 任何 senior 候选人都该答出来
  · medium = 候选人对自己写的东西要有 1 层以上的深入思考
  · hard   = 需要跨领域知识或独立判断

【风格】
- 问题要"有钩子"，让候选人不能套话敷衍
- 优先从 scores.dim_scores 弱项维度找题
- 优先用 scores.keyword_coverage 中 missing 的关键词出 gap_probe

【输出】
只输出符合 schema 的 JSON，questions 数组长度 3-5。`

const EXAMPLE_JD: JDStruct = {
  role_title: '前端工程师 - 数据可视化方向',
  seniority: 'mid',
  hard_skills: [
    { name: 'React', level: 'required' },
    { name: 'D3.js', level: 'preferred' },
  ],
  soft_skills: ['跨职能协作'],
  hidden_requirements: [
    {
      requirement: '能与设计、产品紧密合作',
      evidence: '与设计、产品紧密合作落地可视化组件',
    },
  ],
  keywords: ['React', 'D3.js', '数据可视化', '前端性能'],
  one_liner: '能独立做复杂可视化的前端',
}

const EXAMPLE_RESUME: ResumeStruct = {
  candidate_name: '王某',
  experience_years: 3,
  domain_tags: ['前端'],
  bullets: [
    {
      id: 'b1',
      company: 'X 公司',
      role: '前端',
      text: '主导 React + TypeScript 重构，包体减小 30%',
      has_metrics: true,
    },
    {
      id: 'b2',
      company: 'X 公司',
      role: '前端',
      text: '协调设计和产品上线了新版首页',
      has_metrics: false,
    },
  ],
  highlights: [],
  weaknesses: [{ point: '未提及可视化经验', severity: 'high' }],
  resume_keywords: ['React', 'TypeScript'],
}

const EXAMPLE_SCORES: MatchScores = {
  overall_score: 70,
  grade: 'B',
  dim_scores: {
    tech: 75,
    experience: 80,
    project: 55,
    communication: 75,
    uniqueness: 60,
  },
  summary: '基础匹配，但缺可视化项目证据',
  keyword_coverage: [
    {
      keyword: 'React',
      hit: 'strong',
      evidence: '主导 React + TypeScript 重构',
    },
    { keyword: 'D3.js', hit: 'missing', evidence: '简历未提及' },
    { keyword: '数据可视化', hit: 'missing', evidence: '简历未提及' },
  ],
}

const EXAMPLE_OUTPUT: InterviewerOutputType = {
  questions: [
    {
      question: '你提到 React 重构包体减小 30%，能拆解一下具体做了哪些优化吗？',
      probe_point: '深度 + 量化可信度',
      category: 'technical_depth',
      suggested_angle:
        '从打包工具配置、代码分割、动态导入、依赖治理（tree-shaking / 替换大库）几个层次展开，最好能讲清楚哪一项贡献最大。',
      difficulty: 'medium',
    },
    {
      question: '岗位要求 D3.js / 数据可视化经验，你打算如何补齐这个空缺？',
      probe_point: '应变 + 学习能力',
      category: 'gap_probe',
      suggested_angle:
        '坦诚承认缺口，给出短期补救计划（小项目 / 开源实践），并展示已有的 React + TS 能力如何迁移到可视化场景。',
      difficulty: 'medium',
    },
    {
      question: '"协调设计和产品上线新版首页"——能举一个具体的跨职能冲突和你的处理吗？',
      probe_point: '软技能落地真伪',
      category: 'soft_skill',
      suggested_angle:
        '用 STAR 框架讲一个真实冲突：情境、关键分歧点、你做了什么决策、结果怎样。避免套话。',
      difficulty: 'easy',
    },
  ],
}

export const InterviewerAgent: Agent<InterviewerInputType, InterviewerOutputType> = {
  name: 'interviewer',
  tier: 'heavy',
  inputSchema: InterviewerInput,
  outputSchema: InterviewerOutput,

  run(input, opts: AgentRunOptions): AgentStreamResult<InterviewerOutputType> {
    const parsed = InterviewerInput.parse(input)

    const result = streamObject({
      model: resolveModel(opts.provider, 'heavy'),
      schema: InterviewerOutput,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `示例输入：\n${JSON.stringify(
            {
              jd: EXAMPLE_JD,
              resume: EXAMPLE_RESUME,
              scores: EXAMPLE_SCORES,
            },
            null,
            2,
          )}`,
        },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        {
          role: 'user',
          content: `待出题输入：\n${JSON.stringify(
            { jd: parsed.jd, resume: parsed.resume, scores: parsed.scores },
            null,
            2,
          )}`,
        },
      ],
      temperature: 0.5,
      maxTokens: 2000,
      abortSignal: opts.signal,
    })

    return {
      partialObjectStream: result.partialObjectStream as AsyncIterable<
        Partial<InterviewerOutputType>
      >,
      object: result.object,
      usage: result.usage,
    }
  },
}
