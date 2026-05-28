import { streamObject } from 'ai'
import { RewriterInput, RewriterOutput } from '@/lib/schemas'
import type {
  RewriterInput as RewriterInputType,
  RewriterOutput as RewriterOutputType,
  JDStruct,
  ResumeStruct,
} from '@/lib/schemas'
import { resolveModel } from '@/lib/providers'
import type { Agent, AgentRunOptions, AgentStreamResult } from './types'

const SYSTEM_PROMPT = `你是一名顶级的简历文案教练，专门把"模糊、平淡"的简历 bullet
改写成"具体、有冲击力、命中关键词"的版本。

【改写遵循 STAR + 量化原则】
- 每个 bullet 必须含 Situation / Action / Result 三个要素
- 必须尽量植入 JD 关键词
- **不能编造原文没有的项目或数据** —— 如果候选人原文太模糊导致没数据可量化，
  在 reason 中明确写"原文缺少 XXX 信息，建议候选人补充"

【任务】
针对 target_bullet_ids 列表中的每一条 bullet，给出改写建议。

【字段语义】
- bullet_id: 必须严格来自 target_bullet_ids 列表
- original: 从 resume.bullets 中按 id 找到对应原文，**1:1 复制**
- rewritten: 改写后版本，必须满足
  · 不超过 60 字
  · 含至少 1 个具体动词（主导/设计/优化/重构/带领/搭建/落地…）
  · 含至少 1 个量化指标（具体数字 + 单位），无法量化时显式标记建议补充
  · 命中至少 1 个 JD 关键词
  · **不能编造数据** —— 如果原文没有数据，rewritten 可以使用占位（如 "[QPS 数据待补]"）
    并在 reason 中明确说明
- reason: 30-50 字，说明为什么这样改：
  · 主要改进点（量化 / 动词 / 关键词命中）
  · 对应 JD 哪一项要求
- impact:
  · major = 命中 JD required 关键词、改善 high severity weakness
  · moderate = 命中 preferred 关键词、改善 medium weakness
  · minor = 表达层面的优化
- hit_keywords: 改写后**新**命中的 JD 关键词列表（原文已命中的不算）

【输出硬性约束】
- rewrites 数组长度 = target_bullet_ids 数组长度（一一对应）
- 顺序保持与 target_bullet_ids 一致
- 只输出符合 schema 的 JSON`

const EXAMPLE_JD: JDStruct = {
  role_title: '前端工程师 - 数据可视化方向',
  seniority: 'mid',
  hard_skills: [
    { name: 'React', level: 'required' },
    { name: 'TypeScript', level: 'required' },
    { name: 'D3.js', level: 'preferred' },
  ],
  soft_skills: ['跨职能协作'],
  hidden_requirements: [],
  keywords: ['React', 'TypeScript', 'D3.js', '数据可视化', '性能优化'],
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
      text: '负责前端开发，使用 React 完成业务页面',
      has_metrics: false,
    },
    {
      id: 'b2',
      company: 'X 公司',
      role: '前端',
      text: '参与图表模块的开发',
      has_metrics: false,
    },
  ],
  highlights: [],
  weaknesses: [
    { point: '动词太弱', severity: 'high' },
    { point: '未提及可视化经验', severity: 'high' },
  ],
  resume_keywords: ['React', 'TypeScript'],
}

const EXAMPLE_OUTPUT: RewriterOutputType = {
  rewrites: [
    {
      bullet_id: 'b1',
      original: '负责前端开发，使用 React 完成业务页面',
      rewritten:
        '主导 React + TypeScript 业务页面架构（[页面数待补]，[DAU 待补]），落地性能优化',
      reason: '原文动词弱、无指标；植入 React+TS 关键词，标注量化数据需候选人补充',
      impact: 'major',
      hit_keywords: ['TypeScript', '性能优化'],
    },
    {
      bullet_id: 'b2',
      original: '参与图表模块的开发',
      rewritten:
        '基于 D3.js 自研可复用图表库（[组件数]、[业务覆盖]），支撑数据可视化场景',
      reason: '原文笼统；植入 D3.js + 数据可视化两个核心关键词，鼓励量化',
      impact: 'major',
      hit_keywords: ['D3.js', '数据可视化'],
    },
  ],
}

export const RewriterAgent: Agent<RewriterInputType, RewriterOutputType> = {
  name: 'rewriter',
  tier: 'heavy',
  inputSchema: RewriterInput,
  outputSchema: RewriterOutput,

  run(input, opts: AgentRunOptions): AgentStreamResult<RewriterOutputType> {
    const parsed = RewriterInput.parse(input)

    /* Slice bullets to only those targeted, so the model isn't tempted to
     * rewrite untargeted ones */
    const targetedBullets = parsed.resume.bullets.filter((b) =>
      parsed.target_bullet_ids.includes(b.id),
    )

    const userPayload = {
      jd: parsed.jd,
      resume_meta: {
        candidate_name: parsed.resume.candidate_name,
        weaknesses: parsed.resume.weaknesses,
      },
      target_bullets: targetedBullets,
      target_bullet_ids: parsed.target_bullet_ids,
    }

    const result = streamObject({
      model: resolveModel(opts.provider, 'heavy'),
      schema: RewriterOutput,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `示例输入：\n${JSON.stringify(
            {
              jd: EXAMPLE_JD,
              resume_meta: {
                candidate_name: EXAMPLE_RESUME.candidate_name,
                weaknesses: EXAMPLE_RESUME.weaknesses,
              },
              target_bullets: EXAMPLE_RESUME.bullets,
              target_bullet_ids: ['b1', 'b2'],
            },
            null,
            2,
          )}`,
        },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        {
          role: 'user',
          content: `待改写输入：\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
      temperature: 0.4,
      maxTokens: 2500,
      abortSignal: opts.signal,
    })

    return {
      partialObjectStream: result.partialObjectStream as AsyncIterable<
        Partial<RewriterOutputType>
      >,
      object: result.object,
      usage: result.usage,
    }
  },
}
