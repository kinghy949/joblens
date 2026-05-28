'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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

const INITIAL: Record<string, AgentPanelState> = {
  'jd-parser': {
    title: 'JD 解析 Agent',
    meta: 'meta/llama-3.1-8b · 等待开始',
    state: 'pending',
    body: '',
  },
  'resume-analyst': {
    title: '简历分析 Agent',
    meta: 'meta/llama-3.3-70b · 等待开始',
    state: 'pending',
    body: '',
  },
  'match-scorer': {
    title: '匹配打分 Agent',
    meta: '等待 phase 2',
    state: 'pending',
    body: '',
  },
  'rewriter': {
    title: '改写 Agent',
    meta: '等待 phase 3',
    state: 'pending',
    body: '',
  },
}

export function AnalysisRunner() {
  const router = useRouter()
  const params = useSearchParams()
  const isDemo = params.get('demo') === '1'

  const [panels, setPanels] = useState(INITIAL)
  const [elapsed, setElapsed] = useState(0)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const startedAt = useRef(Date.now())
  const fired = useRef(false)

  /* tick the elapsed clock */
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt.current), 200)
    return () => clearInterval(id)
  }, [])

  /* fire once: read pending payload from sessionStorage, POST /api/analyze */
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

    setPanels((p) => ({
      ...p,
      'jd-parser': { ...p['jd-parser'], state: 'running', meta: 'meta/llama-3.1-8b · 运行中' },
      'resume-analyst': {
        ...p['resume-analyst'],
        state: 'running',
        meta: 'meta/llama-3.3-70b · 运行中',
      },
    }))

    const url = isDemo ? '/api/analyze?demo=1' : '/api/analyze'
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jd_text: payload.jd_text,
        resume_text: payload.resume_text,
      }),
    })
      .then(async (res) => {
        const trace = res.headers.get('x-trace-id')
        if (trace) setTraceId(trace)
        const body = await res.json()
        if (!res.ok) {
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
        }
        sessionStorage.setItem(
          'joblens.analyze.result',
          JSON.stringify(body),
        )
        setPanels((p) => ({
          ...p,
          'jd-parser': updateFromResponse(p['jd-parser'], body.agents['jd-parser'], body.jd_struct, 'jd'),
          'resume-analyst': updateFromResponse(
            p['resume-analyst'],
            body.agents['resume-analyst'],
            body.resume_struct,
            'resume',
          ),
        }))
        // give the user 1s to see the success panels before navigating
        setTimeout(() => {
          router.push(`/result/${trace ?? 'latest'}`)
        }, 1000)
      })
      .catch((err: Error) => {
        setFatalError(err.message)
      })
  }, [isDemo, router])

  const allDone =
    panels['jd-parser'].state === 'done' && panels['resume-analyst'].state === 'done'

  return (
    <div className="min-h-screen bg-surface-container-low">
      {/* top bar */}
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
                  style={{ width: allDone ? '100%' : `${Math.min(95, (elapsed / 12000) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <span className="rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-label-sm text-foreground-variant">
            trace_id: {traceId ? traceId.slice(0, 8) + '…' : '—'}
          </span>
        </div>
      </header>

      {/* phase chips */}
      <div className="border-b border-outline-variant bg-background">
        <div className="mx-auto flex max-w-container items-center gap-3 overflow-x-auto px-6 py-3 md:px-12">
          <PhaseChip state={allDone ? 'done' : 'active'}>阶段 1: JD + 简历解析</PhaseChip>
          <PhaseSep />
          <PhaseChip state="pending">阶段 2: 匹配评分</PhaseChip>
          <PhaseSep />
          <PhaseChip state="pending">阶段 3: 改写 + 面试</PhaseChip>
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

      {/* panels */}
      <main className="mx-auto max-w-container px-6 py-6 md:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(panels).map(([key, p]) => (
            <AgentPanel key={key} {...p} />
          ))}
        </div>
      </main>
    </div>
  )
}

/* ---------- helpers ---------- */

function updateFromResponse(
  current: AgentPanelState,
  agentSummary: { status: 'done' | 'error'; duration_ms: number; tokens_in?: number | null; tokens_out?: number | null; error?: string },
  struct: unknown,
  kind: 'jd' | 'resume',
): AgentPanelState {
  if (agentSummary.status === 'error') {
    return {
      ...current,
      state: 'error',
      meta: `失败 · ${(agentSummary.duration_ms / 1000).toFixed(1)}s`,
      body: agentSummary.error ?? '未知错误',
    }
  }
  return {
    ...current,
    state: 'done',
    meta: `完成 · ${(agentSummary.duration_ms / 1000).toFixed(1)}s`,
    body: summarizeStruct(kind, struct),
    durationMs: agentSummary.duration_ms,
    tokensIn: agentSummary.tokens_in ?? undefined,
    tokensOut: agentSummary.tokens_out ?? undefined,
  }
}

function summarizeStruct(kind: 'jd' | 'resume', struct: unknown): string {
  if (!struct || typeof struct !== 'object') return ''
  const s = struct as Record<string, unknown>
  if (kind === 'jd') {
    const hard = Array.isArray(s.hard_skills) ? s.hard_skills.length : 0
    const kw = Array.isArray(s.keywords) ? s.keywords.length : 0
    const hidden = Array.isArray(s.hidden_requirements) ? s.hidden_requirements.length : 0
    return (
      `> 岗位定位: ${s.role_title ?? '—'} (${s.seniority ?? ''})\n` +
      `> ${hard} 个核心技能 · ${kw} 个关键词 · ${hidden} 个隐藏要求\n` +
      `> ${s.one_liner ?? ''}`
    )
  }
  const bullets = Array.isArray(s.bullets) ? s.bullets.length : 0
  const highlights = Array.isArray(s.highlights) ? s.highlights.length : 0
  const weaknesses = Array.isArray(s.weaknesses) ? s.weaknesses.length : 0
  return (
    `> 候选人: ${s.candidate_name ?? '—'} · ${s.experience_years ?? '?'} 年经验\n` +
    `> ${bullets} 条经历 · ${highlights} 个亮点 · ${weaknesses} 个待改进点`
  )
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
          <div className={`h-7 w-7 rounded ${state === 'done' ? 'bg-foreground' : state === 'error' ? 'bg-destructive' : 'bg-foreground-variant'}`} />
          <div>
            <p className="text-title-lg text-foreground">{title}</p>
            <p className="text-label-sm text-foreground-variant">{meta}</p>
          </div>
        </div>
        <StatusPill state={state} durationMs={durationMs} />
      </header>

      <div className="bg-[#111111] p-4 font-mono text-[13px] leading-6 text-[#e2e2e5] min-h-[200px]">
        {state === 'pending' && (
          <div className="flex h-full flex-col items-center justify-center text-foreground-variant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <rect x="6" y="11" width="12" height="9" rx="1" />
              <path d="M9 11V7a3 3 0 016 0v4" strokeLinecap="round" />
            </svg>
            <p className="mt-2 text-label-md">{title === '改写 Agent' || title === '匹配打分 Agent' ? '该 Agent 将在 Week 2 接入' : '等待中…'}</p>
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
