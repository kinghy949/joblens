import { streamObject } from 'ai'
import { ResumeAnalystInput, ResumeStruct } from '@/lib/schemas'
import type {
  ResumeAnalystInput as ResumeAnalystInputType,
  ResumeStruct as ResumeStructType,
} from '@/lib/schemas'
import { resolveModel } from '@/lib/providers'
import type { Agent, AgentRunOptions, AgentStreamResult } from './types'

const SYSTEM_PROMPT = `你是一名资深的简历评审专家，看过上万份技术简历。
你擅长把简历的原始陈述拆解为结构化的经历事实，识别哪些是"亮点"（具体、量化、有故事），哪些是"弱项"（笼统、缺指标、表达模糊）。

【任务】
把一段中文简历文本拆解为结构化的 JSON。

【字段语义】
- experience_years：从教育/工作时间推算（实习按 0.5 折算）
- domain_tags：候选人最擅长的领域，如"分布式系统"、"电商交易"，最多 8 个
- bullets：把简历正文中所有"工作内容描述"拆成独立 bullet
  · id：用 "b1", "b2", ... 顺序编号
  · company/role：从上下文推断
  · text：原 bullet 内容，<= 280 字
  · has_metrics：是否含**具体数字 + 单位**的量化指标
    （"提升了性能"不算，"提升了 30%" 才算；"日均 200 万请求"算）
- highlights：**必须给出 3-6 条**最有竞争力的亮点（少于 3 条视为漏分析，再宽松也要凑够 3 条）
  优先级：有量化指标 > 主导责任 > 完整项目周期 > 技术深度
  why_strong 解释为什么是亮点，<= 30 字
- weaknesses：**必须给出 3-6 个**明显的弱项（任何中文技术简历都至少能找到 3 处可改进点）
  severity 取值：
  · high = 关键岗位词缺失、表达极其模糊（如"参与开发"）
  · medium = 缺指标、缺主导描述
  · low = 仅仅是用词可优化
- resume_keywords：简历中出现的技术名词和能力词，5-40 个

【风格】
- 不评判候选人本身，只评判简历的表达
- highlights/weaknesses 用"事实+评价"的句式，不喊口号`

const EXAMPLE_INPUT = `# 李某 - 后端工程师

工作经历：

某电商公司 · 后端工程师 · 2021.07 – 至今
- 主导设计高并发订单服务，日均处理 800 万请求，p99 < 50ms
- 推动团队迁移到 Kubernetes，运维成本下降 40%
- 协助测试团队调试接口

技术栈：Go, Python, Postgres, Redis, Kafka, k8s`

const EXAMPLE_OUTPUT: ResumeStructType = {
  candidate_name: '李某',
  experience_years: 3,
  domain_tags: ['后端', '电商', '高并发'],
  bullets: [
    {
      id: 'b1',
      company: '某电商公司',
      role: '后端工程师',
      text: '主导设计高并发订单服务，日均处理 800 万请求，p99 < 50ms',
      has_metrics: true,
    },
    {
      id: 'b2',
      company: '某电商公司',
      role: '后端工程师',
      text: '推动团队迁移到 Kubernetes，运维成本下降 40%',
      has_metrics: true,
    },
    {
      id: 'b3',
      company: '某电商公司',
      role: '后端工程师',
      text: '协助测试团队调试接口',
      has_metrics: false,
    },
  ],
  highlights: [
    {
      point: '主导高并发订单服务',
      why_strong: '有规模 + 性能指标双重量化',
    },
    {
      point: '推动 k8s 迁移并量化收益',
      why_strong: '展示推动力 + 业务价值',
    },
    {
      point: '技术栈覆盖全面，含云原生',
      why_strong: 'Go/Python/k8s 等关键技能齐全',
    },
  ],
  weaknesses: [
    {
      point: '"协助测试团队调试接口"动词太弱',
      severity: 'medium',
    },
    {
      point: '缺少独立项目或开源贡献描述',
      severity: 'medium',
    },
    {
      point: '简历缺少教育背景与时间线',
      severity: 'low',
    },
  ],
  resume_keywords: ['Go', 'Python', 'Postgres', 'Redis', 'Kafka', 'k8s', '高并发', '订单'],
}

export const ResumeAnalystAgent: Agent<ResumeAnalystInputType, ResumeStructType> = {
  name: 'resume-analyst',
  tier: 'heavy',
  inputSchema: ResumeAnalystInput,
  outputSchema: ResumeStruct,

  run(input, opts: AgentRunOptions): AgentStreamResult<ResumeStructType> {
    const parsed = ResumeAnalystInput.parse(input)

    const result = streamObject({
      model: resolveModel(opts.provider, 'heavy'),
      schema: ResumeStruct,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `示例简历：\n\n${EXAMPLE_INPUT}` },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        { role: 'user', content: `待解析的简历：\n\n${parsed.resume_text}` },
      ],
      temperature: 0.3,
      maxTokens: 3000,
      abortSignal: opts.signal,
    })

    return {
      partialObjectStream: result.partialObjectStream as AsyncIterable<
        Partial<ResumeStructType>
      >,
      object: result.object,
      usage: result.usage,
    }
  },
}
