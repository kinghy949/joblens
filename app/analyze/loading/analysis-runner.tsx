/* eslint-disable react-hooks/set-state-in-effect --
 * One-shot fetch effect: reads sessionStorage, opens SSE stream, dispatches
 * setState per agent event. All setState calls happen in response to external
 * events (SSE), not synchronously in the effect body's first tick. */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type AgentName = 'jd-parser' | 'resume-analyst' | 'match-scorer' | 'rewriter' | 'interviewer'
type AgentState = 'pending' | 'running' | 'done' | 'error'

type AgentPanelState = {
  title: string
  meta: string
  state: AgentState
  body: string
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
}

type PendingPayload = {
  jd_text: string
  resume_text: string
  is_demo?: boolean
}

const AGENT_ORDER: AgentName[] = [
  'jd-parser',
  'resume-analyst',
  'match-scorer',
  'rewriter',
  'interviewer',
]

const INITIAL: Record<AgentName, AgentPanelState> = {
  'jd-parser': {
    title: 'JD 解析 Agent',
    meta: 'phase 1 · llama 3.1 8B',
    state: 'pending',
    body: '',
  },
  'resume-analyst': {
    title: '简历分析 Agent',
    meta: 'phase 1 · llama 3.3 70B',
    state: 'pending',
    body: '',
  },
  'match-scorer': {
    title: '匹配打分 Agent',
    meta: 'phase 2 · llama 3.3 70B',
    state: 'pending',
    body: '',
  },
  rewriter: {
    title: '改写 Agent',
    meta: 'phase 3 · llama 3.3 70B',
    state: 'pending',
    body: '',
  },
  interviewer: {
    title: '面试官 Agent',
    meta: 'phase 3 · llama 3.3 70B',
    state: 'pending',
    body: '',
  },
}

type ServerEvent =
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
  | { type: 'final'; context: unknown }
  | { type: 'error'; code: string; message: string }

export function AnalysisRunner() {
  const router = useRouter()
  const params = useSearchParams()
  const isDemo = params.get('demo') === '1'

  const [panels, setPanels] = useState(INITIAL)
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)
  const [elapsed, setElapsed] = useState(0)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const startedAt = useRef<number | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    if (startedAt.current === null) startedAt.current = Date.now()
    const id = setInterval(() => {
      if (startedAt.current !== null) setElapsed(Date.now() - startedAt.current)
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const raw =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('joblens.analyze.pending')
        : null
    if (!raw) {
      setFatalError('找不到分析输入，请回到上一页重新提交。')
      return
    }
    let payload: PendingPayload
    try {
      payload = JSON.parse(raw) as PendingPayload
    } catch {
      setFatalError('分析输入已损坏，请重新提交。')
      return
    }

    const url = isDemo ? '/api/analyze?demo=1' : '/api/analyze'
    const controller = new AbortController()

    runStream(url, payload, controller.signal, {
      onEvent: (ev) => handleEvent(ev, setPanels, setPhase),
      onFinal: (context) => {
        sessionStorage.setItem(
          'joblens.analyze.result',
          JSON.stringify({ ...(context as object), is_demo: isDemo }),
        )
        const ctxAny = context as { trace_id?: string }
        setTimeout(() => {
          router.push(`/result/${ctxAny.trace_id ?? 'latest'}`)
        }, 1200)
      },
      onError: (msg) => setFatalError(msg),
    })

    return () => controller.abort()
  }, [isDemo, router])

  const allDone = AGENT_ORDER.every((a) => panels[a].state === 'done')

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="border-b border-outline-variant bg-background">
        <div className="mx-auto flex max-w-container items-center justify-between px-6 py-3 md:px-12">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 text-body-md text-foreground-variant hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            分析中
          </Link>

          <div className="flex flex-1 items-center justify-center px-12">
            <div className="w-full max-w-md">
              <div className="flex items-center justify-center text-label-md text-foreground-variant">
                <span className="font-mono">
                  {fatalError
                    ? `失败 · ${Math.floor(elapsed / 1000)}s`
                    : allDone
                      ? `完成 · ${(elapsed / 1000).toFixed(1)}s · 跳转中…`
                      : `分析中 · 已用 ${(elapsed / 1000).toFixed(1)}s`}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className="h-full bg-foreground transition-all duration-500"
                  style={{
                    width: allDone ? '100%' : `${Math.min(95, (phase / 3) * 95)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <span className="rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-label-sm text-foreground-variant">
            {isDemo ? 'demo 模式' : 'live'}
          </span>
        </div>
      </header>

      <div className="border-b border-outline-variant bg-background">
        <div className="mx-auto flex max-w-container items-center gap-3 overflow-x-auto px-6 py-3 md:px-12">
          <PhaseChip state={phaseState(phase, 1)}>阶段 1: JD + 简历解析</PhaseChip>
          <PhaseSep />
          <PhaseChip state={phaseState(phase, 2)}>阶段 2: 匹配评分</PhaseChip>
          <PhaseSep />
          <PhaseChip state={phaseState(phase, 3)}>阶段 3: 改写 + 面试</PhaseChip>
        </div>
      </div>

      {fatalError && (
        <div className="mx-auto mt-6 max-w-container px-6 md:px-12">
          <div className="rounded border border-destructive/40 bg-destructive/5 p-4 text-body-md text-destructive">
            <strong>分析失败：</strong> {fatalError}
            <div className="mt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center text-label-md text-foreground underline-offset-2 hover:underline"
              >
                ← 返回输入页
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-container px-6 py-6 md:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {AGENT_ORDER.map((name) => (
            <AgentPanel key={name} {...panels[name]} />
          ))}
        </div>
      </main>
    </div>
  )
}

/* ---------- SSE consumer ---------- */

type StreamHandlers = {
  onEvent: (event: ServerEvent) => void
  onFinal: (context: unknown) => void
  onError: (message: string) => void
}

async function runStream(
  url: string,
  payload: PendingPayload,
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        jd_text: payload.jd_text,
        resume_text: payload.resume_text,
      }),
      signal,
    })
  } catch (err) {
    handlers.onError((err as Error).message)
    return
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body?.error?.message ?? detail
    } catch {}
    handlers.onError(detail)
    return
  }
  if (!res.body) {
    handlers.onError('响应没有可读流')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') handlers.onError((err as Error).message)
      return
    }
    if (chunk.done) return
    buf += decoder.decode(chunk.value, { stream: true })

    while (true) {
      const idx = buf.indexOf('\n\n')
      if (idx === -1) break
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const parsed = parseSseBlock(block)
      if (!parsed) continue
      handlers.onEvent(parsed)
      if (parsed.type === 'final') handlers.onFinal((parsed as { context: unknown }).context)
      if (parsed.type === 'error') handlers.onError((parsed as { message: string }).message)
    }
  }
}

function parseSseBlock(block: string): ServerEvent | null {
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try {
    return JSON.parse(data) as ServerEvent
  } catch {
    return null
  }
}

/* ---------- event → state ---------- */

function handleEvent(
  event: ServerEvent,
  setPanels: React.Dispatch<React.SetStateAction<Record<AgentName, AgentPanelState>>>,
  setPhase: React.Dispatch<React.SetStateAction<0 | 1 | 2 | 3>>,
): void {
  if (event.type === 'agent-start') {
    setPanels((prev) => ({
      ...prev,
      [event.agent]: {
        ...prev[event.agent],
        state: 'running',
        meta: `phase ${event.phase} · 运行中`,
      },
    }))
  } else if (event.type === 'agent-done') {
    setPanels((prev) => ({
      ...prev,
      [event.agent]: {
        ...prev[event.agent],
        state: 'done',
        meta: `完成 · ${(event.duration_ms / 1000).toFixed(1)}s`,
        body: summarizeResult(event.agent, event.result),
        durationMs: event.duration_ms,
        tokensIn: event.tokens_in,
        tokensOut: event.tokens_out,
      },
    }))
  } else if (event.type === 'agent-error') {
    setPanels((prev) => ({
      ...prev,
      [event.agent]: {
        ...prev[event.agent],
        state: 'error',
        meta: `失败`,
        body: event.error,
      },
    }))
  } else if (event.type === 'phase-complete') {
    setPhase(event.phase)
  }
}

function summarizeResult(agent: AgentName, result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const r = result as Record<string, unknown>
  if (agent === 'jd-parser') {
    const hard = (r.hard_skills as unknown[])?.length ?? 0
    const kw = (r.keywords as unknown[])?.length ?? 0
    const hidden = (r.hidden_requirements as unknown[])?.length ?? 0
    return (
      `> 岗位定位: ${r.role_title ?? '—'} (${r.seniority ?? ''})\n` +
      `> ${hard} 个核心技能 · ${kw} 个关键词 · ${hidden} 个隐藏要求\n> ${r.one_liner ?? ''}`
    )
  }
  if (agent === 'resume-analyst') {
    const bullets = (r.bullets as unknown[])?.length ?? 0
    const hl = (r.highlights as unknown[])?.length ?? 0
    const wk = (r.weaknesses as unknown[])?.length ?? 0
    return (
      `> 候选人: ${r.candidate_name ?? '—'} · ${r.experience_years ?? '?'} 年\n` +
      `> ${bullets} 条经历 · ${hl} 亮点 · ${wk} 弱项`
    )
  }
  if (agent === 'match-scorer') {
    const dims = r.dim_scores as Record<string, number> | undefined
    return (
      `> overall: ${r.overall_score} (${r.grade})\n` +
      `> ${r.summary ?? ''}\n` +
      (dims
        ? `> tech ${dims.tech} · exp ${dims.experience} · proj ${dims.project} · comm ${dims.communication} · uniq ${dims.uniqueness}\n`
        : '')
    )
  }
  if (agent === 'rewriter') {
    const rewrites = (r.rewrites as unknown[]) ?? []
    return `> 已产出 ${rewrites.length} 条改写建议`
  }
  if (agent === 'interviewer') {
    const qs = (r.questions as unknown[]) ?? []
    return `> 生成 ${qs.length} 道针对性面试问题`
  }
  return ''
}

/* ---------- presentational ---------- */

function phaseState(currentPhase: number, target: 1 | 2 | 3): 'done' | 'active' | 'pending' {
  if (currentPhase >= target) return 'done'
  if (currentPhase === target - 1) return 'active'
  return 'pending'
}

function PhaseChip({ state, children }: { state: 'done' | 'active' | 'pending'; children: React.ReactNode }) {
  const colors =
    state === 'done'
      ? 'border-foreground bg-foreground text-background'
      : state === 'active'
        ? 'border-foreground bg-background text-foreground'
        : 'border-outline-variant bg-surface-container-lowest text-foreground-variant'
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-label-md ${colors}`}>
      {state === 'done' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'active' && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-foreground" />}
      {state === 'pending' && <span className="inline-flex h-2 w-2 rounded-full border border-outline" />}
      {children}
    </div>
  )
}

function PhaseSep() {
  return <span className="text-outline-variant">→</span>
}

function AgentPanel({ title, meta, state, body, durationMs, tokensIn, tokensOut }: AgentPanelState) {
  return (
    <article className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-7 w-7 rounded ${state === 'done' ? 'bg-foreground' : state === 'error' ? 'bg-destructive' : 'bg-foreground-variant'}`}
          />
          <div>
            <p className="text-title-lg text-foreground">{title}</p>
            <p className="text-label-sm text-foreground-variant">{meta}</p>
          </div>
        </div>
        <StatusPill state={state} durationMs={durationMs} />
      </header>

      <div className="bg-[#111111] p-4 font-mono text-[13px] leading-6 text-[#e2e2e5] min-h-[180px]">
        {state === 'pending' && (
          <div className="flex h-full flex-col items-center justify-center text-foreground-variant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <rect x="6" y="11" width="12" height="9" rx="1" />
              <path d="M9 11V7a3 3 0 016 0v4" strokeLinecap="round" />
            </svg>
            <p className="mt-2 text-label-md">等待依赖完成…</p>
          </div>
        )}
        {state === 'running' && (
          <pre className="whitespace-pre-wrap cursor-blink">{`> 调用模型中…\n> ${title} 正在分析\n`}</pre>
        )}
        {(state === 'done' || state === 'error') && body && (
          <pre className="whitespace-pre-wrap">{body}</pre>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-4 py-2 text-label-sm text-foreground-variant">
        <span>
          {tokensIn !== undefined && tokensOut !== undefined
            ? `tokens: ${tokensIn} in / ${tokensOut} out`
            : state === 'running'
              ? '调用中 …'
              : ''}
        </span>
        <span />
      </footer>
    </article>
  )
}

function StatusPill({ state, durationMs }: { state: AgentState; durationMs?: number }) {
  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm font-medium text-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        COMPLETED {durationMs ? `· ${(durationMs / 1000).toFixed(1)}s` : ''}
      </span>
    )
  }
  if (state === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-0.5 text-label-sm font-medium text-background">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-background" />
        RUNNING
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-0.5 text-label-sm font-medium text-destructive-foreground">
        ERROR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-0.5 text-label-sm font-medium text-foreground-variant">
      等待依赖
    </span>
  )
}
