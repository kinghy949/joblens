import {
  JDParserInput,
  JDStruct,
  ResumeAnalystInput,
  ResumeStruct,
  MatchScorerInput,
  MatchScores,
  RewriterInput,
  RewriterOutput,
  InterviewerInput,
  InterviewerOutput,
  Tier,
} from './schemas'
import { z } from 'zod'

export type AgentName =
  | 'jd-parser'
  | 'resume-analyst'
  | 'match-scorer'
  | 'rewriter'
  | 'interviewer'

export type AgentDef = {
  name: AgentName
  tier: z.infer<typeof Tier>
  inputSchema: z.ZodTypeAny
  outputSchema: z.ZodTypeAny
  reads: string[]
  writes: string[]
  deps: AgentName[]
}

export const AgentRegistry: Record<AgentName, AgentDef> = {
  'jd-parser': {
    name: 'jd-parser',
    tier: 'light',
    inputSchema: JDParserInput,
    outputSchema: JDStruct,
    reads: ['input.jd_text'],
    writes: ['jd_struct'],
    deps: [],
  },
  'resume-analyst': {
    name: 'resume-analyst',
    tier: 'heavy',
    inputSchema: ResumeAnalystInput,
    outputSchema: ResumeStruct,
    reads: ['input.resume_text'],
    writes: ['resume_struct'],
    deps: [],
  },
  'match-scorer': {
    name: 'match-scorer',
    tier: 'heavy',
    inputSchema: MatchScorerInput,
    outputSchema: MatchScores,
    reads: ['jd_struct', 'resume_struct'],
    writes: ['scores'],
    deps: ['jd-parser', 'resume-analyst'],
  },
  rewriter: {
    name: 'rewriter',
    tier: 'heavy',
    inputSchema: RewriterInput,
    outputSchema: RewriterOutput,
    reads: ['jd_struct', 'resume_struct', 'scores'],
    writes: ['rewrites'],
    deps: ['jd-parser', 'resume-analyst', 'match-scorer'],
  },
  interviewer: {
    name: 'interviewer',
    tier: 'heavy',
    inputSchema: InterviewerInput,
    outputSchema: InterviewerOutput,
    reads: ['jd_struct', 'resume_struct', 'scores'],
    writes: ['questions'],
    deps: ['jd-parser', 'resume-analyst', 'match-scorer'],
  },
}

/**
 * 把 AgentRegistry 拓扑分层。返回每一层可并行执行的 Agent 名数组。
 * V1 实际产出 3 层：
 *   [['jd-parser', 'resume-analyst'], ['match-scorer'], ['rewriter', 'interviewer']]
 */
export function topoLayers(): AgentName[][] {
  const remaining = new Set(Object.keys(AgentRegistry) as AgentName[])
  const done = new Set<AgentName>()
  const layers: AgentName[][] = []

  while (remaining.size > 0) {
    const layer: AgentName[] = []
    for (const name of remaining) {
      const def = AgentRegistry[name]
      if (def.deps.every((d) => done.has(d))) layer.push(name)
    }
    if (layer.length === 0) {
      throw new Error('Cycle detected in AgentRegistry deps')
    }
    layers.push(layer)
    for (const name of layer) {
      remaining.delete(name)
      done.add(name)
    }
  }
  return layers
}
