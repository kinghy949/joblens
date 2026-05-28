import { describe, it, expect } from 'vitest'
import {
  JDParserInput,
  JDStruct,
  ResumeStruct,
  MatchScores,
  AnalysisContext,
  SSEEvent,
  SCHEMA_VERSION,
  scoreToGrade,
} from '../index'
import { selectRewriteTargets } from '../rewrite'
import { AgentRegistry, topoLayers } from '../../agent-registry'

describe('common', () => {
  it('SCHEMA_VERSION is 1.0.0', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0')
  })

  it('scoreToGrade thresholds', () => {
    expect(scoreToGrade(95)).toBe('S')
    expect(scoreToGrade(82)).toBe('A')
    expect(scoreToGrade(75)).toBe('B')
    expect(scoreToGrade(60)).toBe('C')
    expect(scoreToGrade(45)).toBe('D')
  })
})

describe('JDParserInput', () => {
  it('rejects short JD', () => {
    expect(() => JDParserInput.parse({ jd_text: 'short' })).toThrow()
  })

  it('accepts valid JD with default locale', () => {
    const parsed = JDParserInput.parse({
      jd_text: '我们正在招聘高级后端工程师'.repeat(5),
    })
    expect(parsed.locale).toBe('zh')
  })
})

describe('JDStruct', () => {
  it('validates a full struct', () => {
    const obj = {
      role_title: '高级后端工程师',
      seniority: 'senior' as const,
      hard_skills: [
        { name: 'Python', level: 'required' as const },
        { name: 'k8s', level: 'preferred' as const },
      ],
      soft_skills: ['沟通', '协作'],
      hidden_requirements: [
        { requirement: '能带 2-3 人小组', evidence: '带领小组完成模块' },
      ],
      keywords: ['Python', 'FastAPI', 'RabbitMQ', 'k8s', 'Postgres'],
      one_liner: '高并发后端 + LLM 应用',
    }
    expect(JDStruct.parse(obj)).toMatchObject(obj)
  })

  it('rejects too few keywords', () => {
    expect(() =>
      JDStruct.parse({
        role_title: 'x',
        seniority: 'senior',
        hard_skills: [],
        soft_skills: [],
        hidden_requirements: [],
        keywords: ['only-one'],
        one_liner: 'x',
      }),
    ).toThrow()
  })
})

describe('ResumeStruct', () => {
  it('validates bullets and bools', () => {
    const r = ResumeStruct.parse({
      experience_years: 3,
      domain_tags: ['backend'],
      bullets: [
        {
          id: 'b1',
          company: 'X 公司',
          role: '后端',
          text: '负责后端 API',
          has_metrics: false,
        },
      ],
      highlights: [],
      weaknesses: [],
      resume_keywords: ['Python', 'FastAPI', 'Redis', 'MySQL', 'Linux'],
    })
    expect(r.bullets[0].has_metrics).toBe(false)
  })
})

describe('selectRewriteTargets', () => {
  const baseJD = {
    role_title: '高级后端',
    seniority: 'senior' as const,
    hard_skills: [
      { name: 'Python', level: 'required' as const },
      { name: 'RAG', level: 'required' as const },
    ],
    soft_skills: [],
    hidden_requirements: [],
    keywords: ['Python', 'RAG', 'FastAPI', 'Postgres', '分布式'],
    one_liner: '高并发 LLM',
  }

  const baseScores = {
    overall_score: 70,
    grade: 'B' as const,
    dim_scores: {
      tech: 70,
      experience: 70,
      project: 70,
      communication: 70,
      uniqueness: 70,
    },
    summary: 'ok',
    keyword_coverage: [
      { keyword: 'Python', hit: 'strong' as const, evidence: '常用' },
      { keyword: 'RAG', hit: 'missing' as const, evidence: '简历未提及' },
    ],
  }

  it('prefers bullets without metrics and with weak keywords', () => {
    const ids = selectRewriteTargets(
      [
        {
          id: 'b1',
          company: 'A',
          role: '工程师',
          text: '负责后端开发，使用 Python',
          has_metrics: false,
        },
        {
          id: 'b2',
          company: 'B',
          role: '工程师',
          text: '主导某项目，QPS 50000，延迟 30ms',
          has_metrics: true,
        },
      ],
      baseJD,
      baseScores,
    )
    expect(ids[0]).toBe('b1')
  })
})

describe('AgentRegistry topological layers', () => {
  it('produces 3 phases matching the design DAG', () => {
    const layers = topoLayers()
    expect(layers).toHaveLength(3)
    expect(layers[0].sort()).toEqual(['jd-parser', 'resume-analyst'])
    expect(layers[1]).toEqual(['match-scorer'])
    expect(layers[2].sort()).toEqual(['interviewer', 'rewriter'])
  })

  it('every Agent has a non-empty schema pair', () => {
    for (const name of Object.keys(AgentRegistry) as Array<
      keyof typeof AgentRegistry
    >) {
      const def = AgentRegistry[name]
      expect(def.inputSchema).toBeDefined()
      expect(def.outputSchema).toBeDefined()
    }
  })
})

describe('AnalysisContext', () => {
  it('applies defaults for schema_version, provider, is_demo', () => {
    const ctx = AnalysisContext.parse({
      trace_id: 'abc',
      started_at: Date.now(),
      input: {
        jd_text: 'jd',
        resume_text: 'r',
        locale: 'zh',
      },
      agent_runs: {},
    })
    expect(ctx.schema_version).toBe('1.0.0')
    expect(ctx.input.provider).toBe('llama')
    expect(ctx.input.is_demo).toBe(false)
  })
})

describe('SSEEvent', () => {
  it('discriminates by type', () => {
    const e = SSEEvent.parse({
      type: 'agent-start',
      agent: 'jd-parser',
      ts: Date.now(),
    })
    expect(e.type).toBe('agent-start')
  })

  it('rejects unknown type', () => {
    expect(() =>
      SSEEvent.parse({ type: 'nope', agent: 'x', ts: 0 } as unknown),
    ).toThrow()
  })
})

describe('placeholder MatchScores happy path', () => {
  it('round trips', () => {
    const s = {
      overall_score: 78,
      grade: 'B' as const,
      dim_scores: {
        tech: 85,
        experience: 72,
        project: 65,
        communication: 80,
        uniqueness: 70,
      },
      summary: '稳进面试',
      keyword_coverage: [],
    }
    expect(MatchScores.parse(s)).toEqual(s)
  })
})
