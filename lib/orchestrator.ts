import { nanoid } from 'nanoid'
import fs from 'node:fs/promises'
import path from 'node:path'
import { JDParserAgent } from './agents/jd-parser'
import { ResumeAnalystAgent } from './agents/resume-analyst'
import { MatchScorerAgent } from './agents/match-scorer'
import { RewriterAgent } from './agents/rewriter'
import { InterviewerAgent } from './agents/interviewer'
import { collectAgentRun } from './agents/types'
import type { Agent, AgentRunOptions } from './agents/types'
import { selectRewriteTargets } from './schemas/rewrite'
import {
  AnalysisContext,
  type AgentRun,
  type ProviderName,
  type Locale,
  type JDStruct,
  type ResumeStruct,
  type MatchScores,
  type Rewrite,
  type InterviewQuestion,
  SCHEMA_VERSION,
} from './schemas'
import type { AgentName } from './agent-registry'
import { EventBus } from './event-bus'

/* ---------- event shapes (server-internal) ---------- */

export type OrchestratorEvent =
  | { type: 'agent-start'; agent: AgentName; phase: 1 | 2 | 3 }
  | {
      type: 'agent-done'
      agent: AgentName
      phase: 1 | 2 | 3
      duration_ms: number
      tokens_in?: number
      tokens_out?: number
      result: unknown
    }
  | { type: 'agent-error'; agent: AgentName; phase: 1 | 2 | 3; error: string }
  | { type: 'phase-complete'; phase: 1 | 2 | 3 }
  | { type: 'final'; context: AnalysisContext }

export type OrchestrateInput = {
  jd_text: string
  resume_text: string
  locale?: Locale
  provider: ProviderName
  is_demo?: boolean
  signal?: AbortSignal
}

/* ---------- public API ---------- */

export function orchestrate(input: OrchestrateInput): AsyncIterable<OrchestratorEvent> {
  const bus = new EventBus<OrchestratorEvent>()
  void runOrchestration(input, bus).finally(() => bus.close())
  return bus
}

/* ---------- internals ---------- */

async function runOrchestration(
  input: OrchestrateInput,
  bus: EventBus<OrchestratorEvent>,
): Promise<void> {
  const trace_id = nanoid(12)
  const started_at = Date.now()

  const ctx: AnalysisContext = {
    schema_version: SCHEMA_VERSION,
    trace_id,
    started_at,
    input: {
      jd_text: input.jd_text,
      resume_text: input.resume_text,
      locale: input.locale ?? 'zh',
      provider: input.provider,
      is_demo: !!input.is_demo,
    },
    agent_runs: {},
  }

  if (input.is_demo) {
    await replayDemo(ctx, bus)
    return
  }

  const opts: AgentRunOptions = { provider: input.provider, signal: input.signal }

  /* -------- Phase 1: JDParser + ResumeAnalyst in parallel -------- */
  const [jdResult, resumeResult] = await Promise.all([
    runOne(JDParserAgent, { jd_text: input.jd_text, locale: ctx.input.locale }, opts, 1, ctx, bus),
    runOne(
      ResumeAnalystAgent,
      { resume_text: input.resume_text, locale: ctx.input.locale },
      opts,
      1,
      ctx,
      bus,
    ),
  ])
  ctx.jd_struct = (jdResult as JDStruct | null) ?? undefined
  ctx.resume_struct = (resumeResult as ResumeStruct | null) ?? undefined
  bus.push({ type: 'phase-complete', phase: 1 })

  if (!ctx.jd_struct || !ctx.resume_struct) {
    bus.push({ type: 'final', context: ctx })
    return
  }

  /* -------- Phase 2: MatchScorer -------- */
  const scoresResult = await runOne(
    MatchScorerAgent,
    { jd: ctx.jd_struct, resume: ctx.resume_struct },
    opts,
    2,
    ctx,
    bus,
  )
  ctx.scores = (scoresResult as MatchScores | null) ?? undefined
  bus.push({ type: 'phase-complete', phase: 2 })

  if (!ctx.scores) {
    bus.push({ type: 'final', context: ctx })
    return
  }

  /* -------- Phase 3: Rewriter + Interviewer in parallel -------- */
  const target_bullet_ids = selectRewriteTargets(
    ctx.resume_struct.bullets,
    ctx.jd_struct,
    ctx.scores,
  )

  const [rewriteResult, interviewResult] = await Promise.all([
    target_bullet_ids.length > 0
      ? runOne(
          RewriterAgent,
          { jd: ctx.jd_struct, resume: ctx.resume_struct, target_bullet_ids },
          opts,
          3,
          ctx,
          bus,
        )
      : Promise.resolve(null),
    runOne(
      InterviewerAgent,
      { jd: ctx.jd_struct, resume: ctx.resume_struct, scores: ctx.scores },
      opts,
      3,
      ctx,
      bus,
    ),
  ])

  if (rewriteResult && typeof rewriteResult === 'object' && 'rewrites' in rewriteResult) {
    ctx.rewrites = (rewriteResult as { rewrites: Rewrite[] }).rewrites
  }
  if (interviewResult && typeof interviewResult === 'object' && 'questions' in interviewResult) {
    ctx.questions = (interviewResult as { questions: InterviewQuestion[] }).questions
  }
  bus.push({ type: 'phase-complete', phase: 3 })
  bus.push({ type: 'final', context: ctx })
}

/** NIM occasionally returns NaN for usage counters. Coerce to undefined. */
function cleanNumber(n: number | null | undefined): number | undefined {
  if (n === null || n === undefined) return undefined
  return Number.isFinite(n) ? n : undefined
}

/* Run a single agent + emit events + record into ctx.agent_runs */
async function runOne<I, O>(
  agent: Agent<I, O>,
  input: I,
  opts: AgentRunOptions,
  phase: 1 | 2 | 3,
  ctx: AnalysisContext,
  bus: EventBus<OrchestratorEvent>,
): Promise<O | null> {
  const name = agent.name as AgentName
  const started_at = Date.now()
  ctx.agent_runs[name] = { status: 'running', started_at }
  bus.push({ type: 'agent-start', agent: name, phase })

  try {
    const stream = agent.run(input, opts)
    const { final, usage } = await collectAgentRun(stream)
    const ended_at = Date.now()
    const run: AgentRun = {
      status: 'done',
      started_at,
      ended_at,
      tokens_in: cleanNumber(usage.promptTokens),
      tokens_out: cleanNumber(usage.completionTokens),
    }
    ctx.agent_runs[name] = run
    bus.push({
      type: 'agent-done',
      agent: name,
      phase,
      duration_ms: ended_at - started_at,
      tokens_in: run.tokens_in,
      tokens_out: run.tokens_out,
      result: final,
    })
    return final
  } catch (err) {
    const ended_at = Date.now()
    const message = (err as Error).message
    ctx.agent_runs[name] = {
      status: 'error',
      started_at,
      ended_at,
      error: message,
    }
    bus.push({ type: 'agent-error', agent: name, phase, error: message })
    return null
  }
}

/* ---------- demo mode: replay golden with simulated phase timings ---------- */

let goldenCache: AnalysisContext | null = null

async function loadGolden(): Promise<{
  jd_struct: JDStruct
  resume_struct: ResumeStruct
  scores?: MatchScores
  rewrites?: Rewrite[]
  questions?: InterviewQuestion[]
}> {
  if (!goldenCache) {
    const file = path.join(process.cwd(), 'fixtures/golden-result.json')
    const raw = JSON.parse(await fs.readFile(file, 'utf-8'))
    goldenCache = raw as unknown as AnalysisContext
  }
  return goldenCache as unknown as {
    jd_struct: JDStruct
    resume_struct: ResumeStruct
    scores?: MatchScores
    rewrites?: Rewrite[]
    questions?: InterviewQuestion[]
  }
}

async function replayDemo(
  ctx: AnalysisContext,
  bus: EventBus<OrchestratorEvent>,
): Promise<void> {
  const golden = await loadGolden()
  const tip = async (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  /* phase 1 */
  bus.push({ type: 'agent-start', agent: 'jd-parser', phase: 1 })
  bus.push({ type: 'agent-start', agent: 'resume-analyst', phase: 1 })
  await tip(1500)
  bus.push({
    type: 'agent-done',
    agent: 'jd-parser',
    phase: 1,
    duration_ms: 1500,
    result: golden.jd_struct,
  })
  ctx.jd_struct = golden.jd_struct
  ctx.agent_runs['jd-parser'] = {
    status: 'done',
    started_at: ctx.started_at,
    ended_at: ctx.started_at + 1500,
  }
  await tip(800)
  bus.push({
    type: 'agent-done',
    agent: 'resume-analyst',
    phase: 1,
    duration_ms: 2300,
    result: golden.resume_struct,
  })
  ctx.resume_struct = golden.resume_struct
  ctx.agent_runs['resume-analyst'] = {
    status: 'done',
    started_at: ctx.started_at,
    ended_at: ctx.started_at + 2300,
  }
  bus.push({ type: 'phase-complete', phase: 1 })

  /* phase 2 — fall through if golden doesn't yet contain scores */
  if (golden.scores) {
    bus.push({ type: 'agent-start', agent: 'match-scorer', phase: 2 })
    await tip(1800)
    bus.push({
      type: 'agent-done',
      agent: 'match-scorer',
      phase: 2,
      duration_ms: 1800,
      result: golden.scores,
    })
    ctx.scores = golden.scores
    ctx.agent_runs['match-scorer'] = {
      status: 'done',
      started_at: ctx.started_at + 2300,
      ended_at: ctx.started_at + 4100,
    }
    bus.push({ type: 'phase-complete', phase: 2 })
  }

  /* phase 3 */
  const hasPhase3 = !!golden.rewrites || !!golden.questions
  if (hasPhase3) {
    if (golden.rewrites) bus.push({ type: 'agent-start', agent: 'rewriter', phase: 3 })
    if (golden.questions) bus.push({ type: 'agent-start', agent: 'interviewer', phase: 3 })
    await tip(1500)
    if (golden.rewrites) {
      bus.push({
        type: 'agent-done',
        agent: 'rewriter',
        phase: 3,
        duration_ms: 1500,
        result: { rewrites: golden.rewrites },
      })
      ctx.rewrites = golden.rewrites
      ctx.agent_runs['rewriter'] = {
        status: 'done',
        started_at: ctx.started_at + 4100,
        ended_at: ctx.started_at + 5600,
      }
    }
    if (golden.questions) {
      bus.push({
        type: 'agent-done',
        agent: 'interviewer',
        phase: 3,
        duration_ms: 1500,
        result: { questions: golden.questions },
      })
      ctx.questions = golden.questions
      ctx.agent_runs['interviewer'] = {
        status: 'done',
        started_at: ctx.started_at + 4100,
        ended_at: ctx.started_at + 5600,
      }
    }
    bus.push({ type: 'phase-complete', phase: 3 })
  }

  bus.push({ type: 'final', context: ctx })
}
