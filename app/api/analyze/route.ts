import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { JDParserAgent } from '@/lib/agents/jd-parser'
import { ResumeAnalystAgent } from '@/lib/agents/resume-analyst'
import { collectAgentRun } from '@/lib/agents/types'
import type { Agent, AgentRunOptions } from '@/lib/agents/types'
import { pickProvider } from '@/lib/providers'
import { ProviderName } from '@/lib/schemas'
import { logger } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const AnalyzeBody = z.object({
  jd_text: z.string().min(50).max(8000),
  resume_text: z.string().min(100).max(15000),
  provider: ProviderName.optional(),
})

type AgentRunSummary = {
  status: 'done' | 'error'
  duration_ms: number
  tokens_in?: number
  tokens_out?: number
  error?: string
}

export async function POST(req: NextRequest) {
  const trace_id = nanoid(12)
  const t0 = Date.now()
  const log = logger.child({ trace_id, route: '/api/analyze' })

  const isDemo = req.nextUrl.searchParams.get('demo') === '1'
  const urlProvider = req.nextUrl.searchParams.get('provider')

  /* Demo mode short-circuits before body validation — content is ignored */
  if (isDemo) {
    const provider = pickProvider(urlProvider)
    log.info({ provider, isDemo: true }, 'analyze demo')
    return demoResponse(trace_id, provider, t0)
  }

  /* Parse + validate body */
  let body: z.infer<typeof AnalyzeBody>
  try {
    body = AnalyzeBody.parse(await req.json())
  } catch (err) {
    log.warn({ err }, 'invalid body')
    return jsonError('INVALID_BODY', (err as Error).message, 400, trace_id)
  }

  const provider = pickProvider(urlProvider ?? body.provider ?? null)
  log.info(
    { provider, jd_len: body.jd_text.length, resume_len: body.resume_text.length },
    'analyze start',
  )

  /* Phase 1: JDParser + ResumeAnalyst in parallel */
  const t1 = Date.now()
  const [jdResult, resumeResult] = await Promise.all([
    runAgent(JDParserAgent, { jd_text: body.jd_text, locale: 'zh' }, { provider }),
    runAgent(
      ResumeAnalystAgent,
      { resume_text: body.resume_text, locale: 'zh' },
      { provider },
    ),
  ])
  const phase1_ms = Date.now() - t1

  /* If both failed, report fatal */
  if (jdResult.status === 'error' && resumeResult.status === 'error') {
    log.error({ jdErr: jdResult.error, resumeErr: resumeResult.error }, 'both agents failed')
    return jsonError('AGENTS_FAILED', '所有 Agent 都执行失败', 502, trace_id)
  }

  const response = {
    trace_id,
    provider,
    schema_version: '1.0.0',
    total_ms: Date.now() - t0,
    phase1_ms,
    agents: {
      'jd-parser': jdResult.summary,
      'resume-analyst': resumeResult.summary,
    },
    jd_struct: jdResult.data ?? null,
    resume_struct: resumeResult.data ?? null,
  }

  log.info(
    { total_ms: response.total_ms, phase1_ms, jd_ok: !!response.jd_struct, resume_ok: !!response.resume_struct },
    'analyze done',
  )

  return NextResponse.json(response, {
    status: 200,
    headers: { 'x-trace-id': trace_id },
  })
}

/**
 * Wraps an agent invocation: drains stream → validates → returns structured
 * result. Errors are caught and reported per-agent so one agent's failure does
 * not bring down the whole request.
 */
async function runAgent<I, O>(
  agent: Agent<I, O>,
  input: I,
  opts: AgentRunOptions,
): Promise<{
  summary: AgentRunSummary
  data: O | null
  status: 'done' | 'error'
  error?: string
}> {
  const t0 = Date.now()
  try {
    const stream = agent.run(input, opts)
    const { final, usage } = await collectAgentRun(stream)
    return {
      summary: {
        status: 'done',
        duration_ms: Date.now() - t0,
        // NIM sometimes doesn't report usage; coerce nullish → undefined
        tokens_in: usage.promptTokens ?? undefined,
        tokens_out: usage.completionTokens ?? undefined,
      },
      data: final,
      status: 'done',
    }
  } catch (err) {
    const message = (err as Error).message
    logger.error({ agent: agent.name, err: message }, 'agent failed')
    return {
      summary: { status: 'error', duration_ms: Date.now() - t0, error: message },
      data: null,
      status: 'error',
      error: message,
    }
  }
}

function jsonError(
  code: string,
  message: string,
  status: number,
  trace_id: string,
) {
  return NextResponse.json(
    { error: { code, message }, trace_id },
    { status, headers: { 'x-trace-id': trace_id } },
  )
}

let goldenCache: { jd_struct: unknown; resume_struct: unknown; provider: string } | null = null

async function loadGolden() {
  if (!goldenCache) {
    const file = path.join(process.cwd(), 'fixtures/golden-result.json')
    goldenCache = JSON.parse(await fs.readFile(file, 'utf-8'))
  }
  return goldenCache!
}

/**
 * Demo-mode short-circuit. Loads the frozen golden result, simulates a
 * realistic per-Agent latency so the UI still feels lively, returns it.
 */
async function demoResponse(trace_id: string, provider: string, t0: number) {
  const golden = await loadGolden()
  // Simulate "phase 1 in parallel" with realistic timings
  const jd_ms = 1200 + Math.floor(Math.random() * 600)
  const resume_ms = 2400 + Math.floor(Math.random() * 800)
  const phase1_ms = Math.max(jd_ms, resume_ms)
  await new Promise((r) => setTimeout(r, phase1_ms))

  return NextResponse.json(
    {
      trace_id,
      provider,
      schema_version: '1.0.0',
      total_ms: Date.now() - t0,
      phase1_ms,
      is_demo: true,
      agents: {
        'jd-parser': {
          status: 'done',
          duration_ms: jd_ms,
          tokens_in: 1866,
          tokens_out: 381,
        },
        'resume-analyst': {
          status: 'done',
          duration_ms: resume_ms,
        },
      },
      jd_struct: golden.jd_struct,
      resume_struct: golden.resume_struct,
    },
    { status: 200, headers: { 'x-trace-id': trace_id, 'x-demo': '1' } },
  )
}
