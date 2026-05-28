import { streamObject } from 'ai'
import { JDParserInput, JDStruct } from '@/lib/schemas'
import type { JDParserInput as JDParserInputType, JDStruct as JDStructType } from '@/lib/schemas'
import { resolveModel } from '@/lib/providers'
import type { Agent, AgentRunOptions, AgentStreamResult } from './types'

const SYSTEM_PROMPT = `你是一名资深的人才市场分析师，擅长从招聘启事的字里行间读出岗位的真实需求——既包括明面上的技能列表，也包括那些写在"职责描述"或"任职要求"里的隐性期待。

【任务】
从一段中文 JD 文本中，提取出结构化的招聘要求，输出符合 schema 的 JSON。

【字段语义】
- role_title：最核心的岗位名称（如"高级后端工程师"），不要带"年薪"等无关词
- seniority：根据年限要求和"主导/负责/参与"等用词判定级别
- hard_skills：所有提到的具体技术，level 取值：
  · required = 用"必备""精通""熟悉"等强语气
  · preferred = 用"较好""了解""有经验"等中等语气
  · bonus = 用"加分""优先"等弱语气
- soft_skills：沟通、协作、leadership 等非技术能力
- hidden_requirements：注意"带 2-3 人小组""能 oncall""跨职能协作"这类隐藏要求，evidence 必须给出 JD 原文片段（10-30 字）
- keywords：用于关键词覆盖匹配，选出 8-20 个最能代表这个岗位的名词术语
- one_liner：一句话总结这个岗位最看重什么，不超过 30 字

【风格】
- 客观、精确，不脑补 JD 没说的东西
- 中文输出（如果 JD 是英文，关键词写中英对照）`

const EXAMPLE_INPUT = `招聘前端工程师 - 数据可视化方向

工作内容：
1. 负责公司核心数据大屏的前端开发与性能优化
2. 与设计、产品紧密合作，落地交互复杂的可视化组件

任职要求：
- 2 年以上前端开发经验，熟悉 React + TypeScript
- 熟悉 D3.js 或 ECharts 等可视化库
- 加分项：有大型数据看板经验`

const EXAMPLE_OUTPUT: JDStructType = {
  role_title: '前端工程师 - 数据可视化方向',
  seniority: 'mid',
  hard_skills: [
    { name: 'React', level: 'required' },
    { name: 'TypeScript', level: 'required' },
    { name: 'D3.js', level: 'preferred' },
    { name: 'ECharts', level: 'preferred' },
    { name: '前端性能优化', level: 'required' },
    { name: '大型数据看板经验', level: 'bonus' },
  ],
  soft_skills: ['跨职能协作'],
  hidden_requirements: [
    {
      requirement: '能与设计、产品紧密合作',
      evidence: '与设计、产品紧密合作，落地交互复杂的可视化组件',
    },
  ],
  keywords: [
    'React',
    'TypeScript',
    'D3.js',
    'ECharts',
    '数据可视化',
    '数据大屏',
    '性能优化',
    '前端组件',
  ],
  one_liner: '能独立做复杂可视化的前端，熟练 React + 可视化库',
}

export const JDParserAgent: Agent<JDParserInputType, JDStructType> = {
  name: 'jd-parser',
  tier: 'light',
  inputSchema: JDParserInput,
  outputSchema: JDStruct,

  run(input, opts: AgentRunOptions): AgentStreamResult<JDStructType> {
    const parsed = JDParserInput.parse(input)

    const result = streamObject({
      model: resolveModel(opts.provider, 'light'),
      schema: JDStruct,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `示例 JD：\n\n${EXAMPLE_INPUT}` },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        { role: 'user', content: `待解析的 JD：\n\n${parsed.jd_text}` },
      ],
      temperature: 0.3,
      maxTokens: 1500,
      abortSignal: opts.signal,
    })

    return {
      partialObjectStream: result.partialObjectStream as AsyncIterable<Partial<JDStructType>>,
      object: result.object,
      usage: result.usage,
    }
  },
}
