import Link from 'next/link'

type AgentState = 'completed' | 'streaming' | 'pending'

const phase1 = { label: '阶段 1: JD + 简历解析', state: 'done' as const }
const phase2 = { label: '阶段 2: 匹配评分', state: 'active' as const }
const phase3 = { label: '阶段 3: 改写 + 面试', state: 'pending' as const }

type Panel = {
  title: string
  meta: string
  status: AgentState
  durationMs?: number
  tokensIn?: number
  tokensOut?: number
  body: string
  streaming?: boolean
}

const panels: Panel[] = [
  {
    title: 'JD 解析 Agent',
    meta: 'meta/llama-3.3 · 完成',
    status: 'completed',
    durationMs: 1830,
    tokensIn: 320,
    tokensOut: 180,
    body: `> 解析岗位 JD ：高级后端工程师 (React/TypeScript)
> 分析完成：
>   • 8 个核心技能命中（React, TypeScript, Webpack/Vite, 客户端架构, 性能优化, Node.js (BFF)）
>   • 3 个软性技能（沟通、协作、推动落地）
>   • 隐藏要求："带 1-2 人小组" → leader experience`,
  },
  {
    title: '简历分析 Agent',
    meta: 'meta/llama-3.3 · 思考中',
    status: 'streaming',
    streaming: true,
    body: `> 解析简历 resume_v3_final.pdf
> 正在结构化文本内容：
>   • 检测到 5 段工作经历，共 11 个 bullets
>   • 标准化经历时间线 (2015-2024)
>   • 工作经历：高级前端 → Senior Engineer → Engineering Lead
>   • 识别简历高亮 (4 项)
>     1. 端到端架构能力（性能、稳定性、监控）
>     2. 主导核心业务模块（设计 → 实现 → 上线）
>   预估弱项数量并对齐 JD 关键词 …`,
  },
  {
    title: '匹配打分 Agent',
    meta: 'meta/llama-3.3 · 等待依赖',
    status: 'pending',
    body: `> 任务编排状态：
>   ▣ 已接收 JD 解析结果（hard_skills × 8）
>   □ 等待简历分析输出（resume_struct）
>
> 等待简历分析完成后开始多维度打分 …`,
  },
  {
    title: '改写 Agent',
    meta: '等待匹配评分',
    status: 'pending',
    body: '',
  },
]

export default function AnalyzeLoadingPage() {
  return (
    <div className="min-h-screen bg-surface-container-low">
      {/* Top status bar */}
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
                <span className="font-mono">分析中 · 已用 8 秒 · 预计还需 7 秒</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-container">
                <div className="h-full w-1/2 bg-foreground transition-all" />
              </div>
            </div>
          </div>

          <span className="rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-label-sm text-foreground-variant">
            trace_id: a8f3c0…
          </span>
        </div>
      </header>

      {/* Phase chips */}
      <div className="border-b border-outline-variant bg-background">
        <div className="mx-auto flex max-w-container items-center gap-3 overflow-x-auto px-6 py-3 md:px-12">
          <PhaseChip state="done">阶段 1: JD + 简历解析</PhaseChip>
          <PhaseSep />
          <PhaseChip state="active">阶段 2: 匹配评分</PhaseChip>
          <PhaseSep />
          <PhaseChip state="pending">阶段 3: 改写 + 面试</PhaseChip>
        </div>
      </div>

      {/* Agent panels grid */}
      <main className="mx-auto max-w-container px-6 py-6 md:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {panels.map((p) => (
            <AgentPanel key={p.title} {...p} />
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button className="text-label-md text-foreground-variant underline-offset-2 hover:text-foreground hover:underline">
            取消分析
          </button>
        </div>
      </main>
    </div>
  )
}

function PhaseChip({
  state,
  children,
}: {
  state: 'done' | 'active' | 'pending'
  children: React.ReactNode
}) {
  const colors =
    state === 'done'
      ? 'border-foreground bg-foreground text-background'
      : state === 'active'
        ? 'border-foreground bg-background text-foreground'
        : 'border-outline-variant bg-surface-container-lowest text-foreground-variant'
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-label-md ${colors}`}
    >
      {state === 'done' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'active' && (
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-foreground" />
      )}
      {state === 'pending' && (
        <span className="inline-flex h-2 w-2 rounded-full border border-outline" />
      )}
      {children}
    </div>
  )
}

function PhaseSep() {
  return <span className="text-outline-variant">→</span>
}

function AgentPanel({
  title,
  meta,
  status,
  durationMs,
  tokensIn,
  tokensOut,
  body,
  streaming,
}: Panel) {
  return (
    <article className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-foreground" />
          <div>
            <p className="text-title-lg text-foreground">{title}</p>
            <p className="text-label-sm text-foreground-variant">{meta}</p>
          </div>
        </div>
        <StatusPill status={status} durationMs={durationMs} />
      </header>

      <div className="bg-[#111111] p-4 font-mono text-[13px] leading-6 text-[#e2e2e5] min-h-[220px]">
        {status === 'pending' && !body && (
          <div className="flex h-full flex-col items-center justify-center text-foreground-variant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <rect x="6" y="11" width="12" height="9" rx="1" />
              <path d="M9 11V7a3 3 0 016 0v4" strokeLinecap="round" />
            </svg>
            <p className="mt-2 text-label-md">等待匹配评分完成…</p>
          </div>
        )}
        {body && (
          <pre className={`whitespace-pre-wrap ${streaming ? 'cursor-blink' : ''}`}>
            {body}
          </pre>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-4 py-2 text-label-sm text-foreground-variant">
        <span>
          {status === 'completed' && tokensIn && tokensOut
            ? `tokens: ${tokensIn} in / ${tokensOut} out`
            : status === 'streaming'
              ? '流式中 …'
              : ''}
        </span>
        <span>
          {status === 'completed' && tokensIn && tokensOut
            ? `cost ≈ $${(((tokensIn + tokensOut) / 1_000_000) * 0.6).toFixed(4)}`
            : ''}
        </span>
      </footer>
    </article>
  )
}

function StatusPill({ status, durationMs }: { status: AgentState; durationMs?: number }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm font-medium text-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        COMPLETED {durationMs ? `· ${(durationMs / 1000).toFixed(1)}s` : ''}
      </span>
    )
  }
  if (status === 'streaming') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-0.5 text-label-sm font-medium text-background">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-background" />
        STREAMING
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-0.5 text-label-sm font-medium text-foreground-variant">
      等待依赖
    </span>
  )
}
