import { streamObject } from 'ai'
import { MatchScorerInput, MatchScores } from '@/lib/schemas'
import type {
  MatchScorerInput as MatchScorerInputType,
  MatchScores as MatchScoresType,
  JDStruct,
  ResumeStruct,
} from '@/lib/schemas'
import { resolveModel } from '@/lib/providers'
import type { Agent, AgentRunOptions, AgentStreamResult } from './types'

const SYSTEM_PROMPT = `你是一名顶级技术招聘官，能在 30 秒内判断一份简历是否匹配一个岗位，
并用 5 个维度的结构化评分把判断透明化，让候选人清楚知道该改进哪里。

【任务】
基于已经解析好的 JD 结构和简历结构，输出一份匹配评分报告。

【5 个维度（构成雷达图）】
1. tech（技术匹配 / 权重 30%）
   - 90+：JD required 技能全覆盖且有深度证据
   - 70-89：required 覆盖 ≥ 80%
   - 50-69：required 覆盖 50-80%
   - <50：关键 required 缺失
2. experience（经验匹配 / 权重 20%）
   - JD 要 3 年简历 3 年: 80+
   - JD 要 3 年简历 5 年且有主导经历: 90+
   - JD 要 senior 但简历只有"参与": 降 20 分
3. project（项目相关性 / 权重 20%）
   - 同领域 + 同规模: 90+
   - 同技术栈但不同场景: 70-80
   - 弱相关: 50-60
4. communication（沟通信号 / 权重 15%）
   - 有量化指标 + 主导动词 + 结构清晰: 80+
   - 笼统词多 / 缺指标: 50-70
5. uniqueness（亮点稀缺度 / 权重 15%）
   - 开源贡献 / 独立项目 / 罕见技术深度: 85+
   - 标准化经历: 60-70

【综合分与等级】
overall_score = round(0.3*tech + 0.2*experience + 0.2*project + 0.15*communication + 0.15*uniqueness)
grade: S>=90, A>=80, B>=70, C>=60, D<60

【关键词覆盖 · 硬性要求】
- **必须遍历 jd.keywords 的每一项**，对每个 keyword 输出一条 keyword_coverage 记录
- 即使简历中完全没有该关键词，也必须输出 hit="missing" 的记录（不要省略）
- keyword_coverage 数组长度应等于 jd.keywords 的长度（或在 25 上限内尽量贴近）
- 判定规则：
  · strong  = 有具体项目/经历支撑（不是仅出现在"技术栈"列表里）
  · weak    = 仅在"技术栈"列表出现，没有经历支撑
  · missing = 简历中完全没有
- evidence: 命中时给出简历中的具体片段；未命中时填"简历未提及"

【summary 风格】
- ≤ 30 字，中肯而非奉承
- 70-79 B+ 示例："稳进面试，但需补强 X"
- < 60 示例："方向性偏差，需要补 X 项目"
- 90+ 示例："强匹配，可重点突出 X"

【输出】
只输出符合 schema 的 JSON。`

const EXAMPLE_INPUT_JD: JDStruct = {
  role_title: '前端工程师 - 数据可视化方向',
  seniority: 'mid',
  hard_skills: [
    { name: 'React', level: 'required' },
    { name: 'TypeScript', level: 'required' },
    { name: 'D3.js', level: 'preferred' },
  ],
  soft_skills: ['跨职能协作'],
  hidden_requirements: [],
  keywords: ['React', 'TypeScript', 'D3.js', '数据可视化', '前端性能'],
  one_liner: '能独立做复杂可视化的前端',
}

const EXAMPLE_INPUT_RESUME: ResumeStruct = {
  candidate_name: '王某',
  experience_years: 3,
  domain_tags: ['前端', 'React'],
  bullets: [
    {
      id: 'b1',
      company: 'X 公司',
      role: '前端工程师',
      text: '主导 React + TypeScript 重构，包体减小 30%',
      has_metrics: true,
    },
  ],
  highlights: [{ point: 'React 主导重构', why_strong: '有量化收益' }],
  weaknesses: [{ point: '未提及可视化经验', severity: 'high' }],
  resume_keywords: ['React', 'TypeScript', 'Webpack', 'CI/CD'],
}

const EXAMPLE_OUTPUT: MatchScoresType = {
  overall_score: 72,
  grade: 'B',
  dim_scores: {
    tech: 80,
    experience: 80,
    project: 60,
    communication: 75,
    uniqueness: 60,
  },
  summary: '基础匹配好，但缺可视化项目证据',
  keyword_coverage: [
    {
      keyword: 'React',
      hit: 'strong',
      evidence: '主导 React + TypeScript 重构，包体减小 30%',
    },
    {
      keyword: 'TypeScript',
      hit: 'strong',
      evidence: '主导 React + TypeScript 重构',
    },
    { keyword: 'D3.js', hit: 'missing', evidence: '简历未提及' },
    { keyword: '数据可视化', hit: 'missing', evidence: '简历未提及' },
    { keyword: '前端性能', hit: 'weak', evidence: '包体减小 30% 暗示但不专门' },
  ],
}

export const MatchScorerAgent: Agent<MatchScorerInputType, MatchScoresType> = {
  name: 'match-scorer',
  tier: 'heavy',
  inputSchema: MatchScorerInput,
  outputSchema: MatchScores,

  run(input, opts: AgentRunOptions): AgentStreamResult<MatchScoresType> {
    const parsed = MatchScorerInput.parse(input)

    const result = streamObject({
      model: resolveModel(opts.provider, 'heavy'),
      schema: MatchScores,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `示例输入：\n\nJD:\n${JSON.stringify(EXAMPLE_INPUT_JD, null, 2)}\n\n简历:\n${JSON.stringify(EXAMPLE_INPUT_RESUME, null, 2)}`,
        },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        {
          role: 'user',
          content: `待评分输入：\n\nJD:\n${JSON.stringify(parsed.jd, null, 2)}\n\n简历:\n${JSON.stringify(parsed.resume, null, 2)}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 2500,
      abortSignal: opts.signal,
    })

    return {
      partialObjectStream: result.partialObjectStream as AsyncIterable<
        Partial<MatchScoresType>
      >,
      object: result.object,
      usage: result.usage,
    }
  },
}
