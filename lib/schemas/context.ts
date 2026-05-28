import { z } from 'zod'
import {
  AgentStatus,
  Locale,
  ProviderName,
  SCHEMA_VERSION,
} from './common'
import { JDStruct } from './jd'
import { ResumeStruct } from './resume'
import { MatchScores } from './match'
import { Rewrite } from './rewrite'
import { InterviewQuestion } from './interview'

export const AgentRun = z.object({
  status: AgentStatus,
  started_at: z.number(),
  ended_at: z.number().optional(),
  tokens_in: z.number().optional(),
  tokens_out: z.number().optional(),
  cost_usd: z.number().optional(),
  cache_hit: z.boolean().optional(),
  error: z.string().optional(),
})
export type AgentRun = z.infer<typeof AgentRun>

export const AnalysisContext = z.object({
  schema_version: z.string().default(SCHEMA_VERSION),
  trace_id: z.string(),
  started_at: z.number(),

  input: z.object({
    jd_text: z.string(),
    resume_text: z.string(),
    locale: Locale,
    provider: ProviderName.default('llama'),
    is_demo: z.boolean().default(false),
  }),

  jd_struct: JDStruct.optional(),
  resume_struct: ResumeStruct.optional(),
  scores: MatchScores.optional(),
  rewrites: z.array(Rewrite).optional(),
  questions: z.array(InterviewQuestion).optional(),

  agent_runs: z.record(z.string(), AgentRun),
})
export type AnalysisContext = z.infer<typeof AnalysisContext>

/* ---------- SSE event schema (server → client) ---------- */

export const SSEEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agent-start'),
    agent: z.string(),
    ts: z.number(),
  }),
  z.object({
    type: z.literal('agent-narration'),
    agent: z.string(),
    chunk: z.string(),
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
export type SSEEvent = z.infer<typeof SSEEvent>
