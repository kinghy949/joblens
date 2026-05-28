/* eslint-disable react-hooks/set-state-in-effect --
 * Result view bootstraps by reading sessionStorage / fetching the share API
 * once on mount. The setState calls live inside async callbacks or directly
 * after sync IO; they are intentional and idempotent (the id dep + the
 * router instance covers identity). */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { RadarChart } from '@/components/radar-chart'

type Hit = 'strong' | 'weak' | 'missing'
type Impact = 'major' | 'moderate' | 'minor'
type Category =
  | 'technical_depth'
  | 'gap_probe'
  | 'soft_skill'
  | 'project_detail'
  | 'scenario'
type Difficulty = 'easy' | 'medium' | 'hard'

type Rewrite = {
  bullet_id: string
  original: string
  rewritten: string
  reason: string
  impact: Impact
  hit_keywords: string[]
}

type InterviewQuestion = {
  question: string
  probe_point: string
  category: Category
  suggested_angle: string
  difficulty: Difficulty
}

type KeywordCoverage = {
  keyword: string
  hit: Hit
  evidence: string
}

type Scores = {
  overall_score: number
  grade: string
  dim_scores: {
    tech: number
    experience: number
    project: number
    communication: number
    uniqueness: number
  }
  summary: string
  keyword_coverage: KeywordCoverage[]
}

type StoredResult = {
  trace_id?: string
  is_demo?: boolean
  jd_struct?: {
    role_title?: string
    seniority?: string
    one_liner?: string
    keywords?: string[]
  } | null
  resume_struct?: {
    candidate_name?: string
    experience_years?: number
    bullets?: { id: string; text: string; has_metrics: boolean }[]
  } | null
  scores?: Scores
  rewrites?: Rewrite[]
  questions?: InterviewQuestion[]
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: StoredResult; source: 'session' | 'shared' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

function loadFromSession(id: string): StoredResult | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem('joblens.analyze.result')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredResult
    if (parsed.trace_id === id || id === 'latest') return parsed
    return null
  } catch {
    return null
  }
}

export function ResultView({ id }: { id: string }) {
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    const local = loadFromSession(id)
    if (local) {
      setState({ kind: 'ready', data: local, source: 'session' })
      return
    }
    if (id === 'latest') {
      // expected but missing — user opened a stale link
      setState({ kind: 'not-found' })
      return
    }
    // fetch shared
    void (async () => {
      try {
        const res = await fetch(`/api/result/${encodeURIComponent(id)}`)
        if (res.status === 410) {
          router.replace(`/result/${id}/expired`)
          return
        }
        if (res.status === 404) {
          setState({ kind: 'not-found' })
          return
        }
        if (!res.ok) {
          setState({ kind: 'error', message: `HTTP ${res.status}` })
          return
        }
        const body = await res.json()
        const ctx = body?.context
        if (!ctx) {
          setState({ kind: 'not-found' })
          return
        }
        setState({
          kind: 'ready',
          data: { ...(ctx as StoredResult), trace_id: body.id ?? id },
          source: 'shared',
        })
      } catch (err) {
        setState({ kind: 'error', message: (err as Error).message })
      }
    })()
  }, [id, router])

  if (state.kind === 'loading') {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-body-md text-foreground-variant">加载中…</p>
      </main>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-headline-lg">没找到分析结果</h1>
          <p className="mt-3 text-body-md text-foreground-variant">
            可能是因为：你直接打开了这个链接，或浏览器 sessionStorage 已被清空，或这个分享链接已被删除。
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex h-12 items-center rounded bg-primary px-6 text-body-md font-medium text-primary-foreground"
          >
            重新分析 →
          </Link>
        </div>
      </main>
    )
  }

  if (state.kind === 'error') {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-headline-lg text-destructive">加载失败</h1>
          <p className="mt-3 text-body-md text-foreground-variant">{state.message}</p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex h-12 items-center rounded bg-primary px-6 text-body-md font-medium text-primary-foreground"
          >
            重新分析 →
          </Link>
        </div>
      </main>
    )
  }

  // ready
  return <FullResult data={state.data} traceId={id} source={state.source} />
}

function FullResult({
  data,
  traceId,
  source,
}: {
  data: StoredResult
  traceId: string
  source: 'session' | 'shared'
}) {
  const jd = data.jd_struct ?? {}
  const resume = data.resume_struct ?? {}
  const scores = data.scores
  const rewrites = data.rewrites ?? []
  const questions = data.questions ?? []

  const radarData = scores
    ? [
        { label: '技术匹配', value: scores.dim_scores.tech },
        { label: '经验', value: scores.dim_scores.experience },
        { label: '项目相关', value: scores.dim_scores.project },
        { label: '沟通', value: scores.dim_scores.communication },
        { label: '亮点稀缺度', value: scores.dim_scores.uniqueness },
      ]
    : null

  const coverage = scores?.keyword_coverage ?? []
  const strong = coverage.filter((k) => k.hit === 'strong')
  const weak = coverage.filter((k) => k.hit === 'weak')
  const missingKw = coverage.filter((k) => k.hit === 'missing')

  return (
    <main className="flex-1 pb-24">
      {data.is_demo && (
        <div className="border-b border-outline-variant bg-surface-container-low">
          <div className="mx-auto flex max-w-container items-center justify-between px-6 py-2 md:px-12">
            <span className="text-label-md text-foreground-variant">
              🎬 Demo 模式 — 内容来自冻结的示例结果
            </span>
            <Link href="/analyze" className="text-label-md text-foreground underline-offset-2 hover:underline">
              用真实数据再试一次 →
            </Link>
          </div>
        </div>
      )}

      {/* Hero score */}
      <section className="mx-auto max-w-container px-6 pt-12 md:px-12">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="flex items-center gap-8">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-foreground">
                <span className="text-[64px] font-semibold leading-none tracking-tight">
                  {scores?.overall_score ?? '—'}
                </span>
              </div>
              {scores && (
                <div>
                  <span className="inline-flex items-center rounded bg-foreground px-2.5 py-0.5 text-label-md font-medium text-background">
                    GRADE {scores.grade}
                  </span>
                </div>
              )}
            </div>
            <h1 className="mt-8 text-headline-lg text-foreground">
              {scores?.summary ?? jd.one_liner ?? '匹配度评估'}
            </h1>
            {jd.role_title && (
              <p className="mt-2 max-w-xl text-body-md text-foreground-variant">
                针对岗位 <span className="text-foreground font-medium">{jd.role_title}</span>
                {jd.seniority ? `（${jd.seniority}）` : ''}
                {resume.candidate_name ? ` · 候选人 ${resume.candidate_name}` : ''}
                {resume.experience_years !== undefined ? ` · ${resume.experience_years} 年经验` : ''}
              </p>
            )}
          </div>

          {radarData && (
            <div className="flex items-center justify-center md:col-span-5">
              <RadarChart size={300} data={radarData} />
            </div>
          )}
        </div>
      </section>

      {/* Keyword coverage heatmap */}
      {coverage.length > 0 && (
        <section className="mx-auto mt-16 max-w-container px-6 md:px-12">
          <div className="flex items-baseline gap-3">
            <h2 className="text-headline-md">关键词覆盖</h2>
            <span className="text-body-md text-foreground-variant">
              JD {coverage.length} 个关键词 · 命中 {strong.length + weak.length} 个
            </span>
          </div>

          {strong.length > 0 && (
            <KeywordRow label={`强匹配 (${strong.length})`} tone="strong" items={strong} />
          )}
          {weak.length > 0 && (
            <KeywordRow label={`弱匹配 (${weak.length})`} tone="weak" items={weak} />
          )}
          {missingKw.length > 0 && (
            <KeywordRow
              label={`未命中 — 严重缺失 (${missingKw.length})`}
              tone="missing"
              items={missingKw}
            />
          )}
        </section>
      )}

      <div className="my-12 border-t border-outline-variant" />

      {/* Action bar */}
      <section className="mx-auto max-w-container px-6 md:px-12">
        <ShareActionBar data={data} traceId={traceId} source={source} />
      </section>

      {/* Rewrites */}
      {rewrites.length > 0 && (
        <Rewrites rewrites={rewrites} bulletText={mapBulletText(resume.bullets)} />
      )}

      {/* Interview questions */}
      {questions.length > 0 && <Questions questions={questions} />}

    </main>
  )
}

/* ---------- share action bar ---------- */

type ShareState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'created'; url: string; expires_at: string }
  | { kind: 'error'; message: string }

function ShareActionBar({
  data,
  traceId,
  source,
}: {
  data: StoredResult
  traceId: string
  source: 'session' | 'shared'
}) {
  const [share, setShare] = useState<ShareState>(() =>
    source === 'shared'
      ? { kind: 'created', url: typeof window !== 'undefined' ? window.location.href : '', expires_at: '' }
      : { kind: 'idle' },
  )

  async function generate() {
    setShare({ kind: 'creating' })
    try {
      /* strip is_demo so a demo run never produces a confusing public link */
      const payload = { ...data }
      delete (payload as { is_demo?: boolean }).is_demo

      const res = await fetch('/api/result', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setShare({ kind: 'error', message: body?.error?.message ?? `HTTP ${res.status}` })
        return
      }
      const url = `${window.location.origin}/result/${body.id}`
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* clipboard may not be available; user can still copy from the input below */
      }
      setShare({ kind: 'created', url, expires_at: body.expires_at })
    } catch (err) {
      setShare({ kind: 'error', message: (err as Error).message })
    }
  }

  async function copyExisting(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-md text-foreground-variant">
          {source === 'shared'
            ? '你正在查看一个分享链接 · 24 小时后自动删除'
            : '本报告仅存在你的浏览器；点"生成分享链接"才会存到服务器，24h 后自动删'}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled
            className="inline-flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-foreground-variant"
          >
            下载 PDF (V2)
          </button>
          {source === 'session' && (
            <button
              onClick={generate}
              disabled={share.kind === 'creating'}
              className="inline-flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-foreground hover:bg-surface-container-low disabled:opacity-50"
            >
              {share.kind === 'creating' ? '生成中…' : '🔗 生成分享链接'}
            </button>
          )}
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-label-md font-medium text-primary-foreground hover:opacity-90"
          >
            再分析一份 →
          </Link>
        </div>
      </div>

      {share.kind === 'created' && (
        <div className="flex items-center gap-2 rounded border border-success/30 bg-success/5 px-3 py-2 text-label-md">
          <span className="text-success">✓</span>
          <span className="text-foreground-variant">链接已生成并复制到剪贴板：</span>
          <code className="flex-1 truncate rounded bg-surface-container-low px-2 py-0.5 font-mono text-foreground">
            {share.url}
          </code>
          <button
            onClick={() => copyExisting(share.url)}
            className="rounded border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-label-sm text-foreground hover:bg-surface-container-low"
          >
            复制
          </button>
        </div>
      )}

      {share.kind === 'error' && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-label-md text-destructive">
          ✗ 生成失败：{share.message}
        </div>
      )}

      <span className="text-label-sm text-foreground-variant">trace_id: {traceId}</span>
    </div>
  )
}

/* ---------- keyword chips ---------- */

function KeywordRow({
  label,
  tone,
  items,
}: {
  label: string
  tone: Hit
  items: KeywordCoverage[]
}) {
  const chipClass =
    tone === 'strong'
      ? 'border-outline-variant bg-surface-container-lowest text-foreground'
      : tone === 'weak'
        ? 'border-warning/40 bg-warning/10 text-foreground'
        : 'border-destructive/40 bg-destructive/5 text-destructive line-through'
  const icon = tone === 'strong' ? '✓' : tone === 'weak' ? '△' : '×'
  return (
    <div className="mt-5">
      <p className="text-label-md text-foreground-variant">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.keyword}
            title={it.evidence}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-label-md ${chipClass}`}
          >
            <span aria-hidden>{icon}</span>
            {it.keyword}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- rewrites ---------- */

const IMPACT_ORDER: Record<Impact, number> = { major: 0, moderate: 1, minor: 2 }
const IMPACT_LABEL: Record<Impact, string> = {
  major: 'HIGH IMPACT',
  moderate: 'MEDIUM IMPACT',
  minor: 'LOW IMPACT',
}

function mapBulletText(bullets: { id: string; text: string }[] | undefined): Map<string, string> {
  const m = new Map<string, string>()
  if (!bullets) return m
  for (const b of bullets) m.set(b.id, b.text)
  return m
}

function Rewrites({
  rewrites,
  bulletText,
}: {
  rewrites: Rewrite[]
  bulletText: Map<string, string>
}) {
  const [filter, setFilter] = useState<'all' | Impact>('all')

  const sorted = useMemo(() => {
    const arr = filter === 'all' ? rewrites.slice() : rewrites.filter((r) => r.impact === filter)
    arr.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
    return arr
  }, [rewrites, filter])

  const counts = useMemo(() => {
    return rewrites.reduce(
      (acc, r) => ((acc[r.impact] = (acc[r.impact] ?? 0) + 1), acc),
      {} as Record<string, number>,
    )
  }, [rewrites])

  return (
    <section className="mx-auto mt-12 max-w-container px-6 md:px-12">
      <h2 className="text-headline-md">改写建议</h2>
      <p className="mt-1 text-body-md text-foreground-variant">
        共 {rewrites.length} 条，按影响力排序
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 {rewrites.length}
        </FilterChip>
        <FilterChip active={filter === 'major'} onClick={() => setFilter('major')}>
          ★★★ 高 {counts.major ?? 0}
        </FilterChip>
        <FilterChip active={filter === 'moderate'} onClick={() => setFilter('moderate')}>
          ★★ 中 {counts.moderate ?? 0}
        </FilterChip>
        <FilterChip active={filter === 'minor'} onClick={() => setFilter('minor')}>
          ★ 低 {counts.minor ?? 0}
        </FilterChip>
      </div>

      <div className="mt-6 space-y-4">
        {sorted.map((r, i) => (
          <RewriteCard key={`${r.bullet_id}-${i}`} rewrite={r} bulletText={bulletText} />
        ))}
      </div>
    </section>
  )
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-label-md transition ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-outline-variant bg-surface-container-lowest text-foreground hover:bg-surface-container-low'
      }`}
    >
      {children}
    </button>
  )
}

function RewriteCard({
  rewrite,
  bulletText,
}: {
  rewrite: Rewrite
  bulletText: Map<string, string>
}) {
  const original = rewrite.original || bulletText.get(rewrite.bullet_id) || '（原文未找到）'
  const impactBadge =
    rewrite.impact === 'major'
      ? 'bg-foreground text-background'
      : rewrite.impact === 'moderate'
        ? 'bg-surface-container-high text-foreground'
        : 'bg-surface-container-low text-foreground-variant'

  return (
    <article className="rounded border border-outline-variant bg-surface-container-lowest p-5">
      <header className="flex items-center justify-between gap-3">
        <p className="text-label-md text-foreground-variant">
          bullet_id: <span className="font-mono text-foreground">{rewrite.bullet_id}</span>
        </p>
        <span className={`rounded px-2 py-0.5 text-label-sm font-medium ${impactBadge}`}>
          {IMPACT_LABEL[rewrite.impact]}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border-l-2 border-destructive bg-surface-container-low p-4">
          <p className="text-label-sm uppercase tracking-wider text-destructive">✗ 原文</p>
          <p className="mt-2 text-body-md text-foreground line-through decoration-destructive/40">
            {original}
          </p>
        </div>
        <div className="rounded border-l-2 border-success bg-surface-container-low p-4">
          <p className="text-label-sm uppercase tracking-wider text-success">✓ 改写后</p>
          <p className="mt-2 text-body-md text-foreground">{rewrite.rewritten}</p>
        </div>
      </div>

      <div className="mt-4 rounded border-l-2 border-foreground bg-surface-container-low p-4">
        <p className="text-label-md text-foreground-variant">💡 改写理由</p>
        <p className="mt-1 text-body-md text-foreground">{rewrite.reason}</p>
      </div>

      {rewrite.hit_keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-label-sm text-foreground-variant">新命中关键词:</span>
          {rewrite.hit_keywords.map((kw) => (
            <span
              key={kw}
              className="rounded bg-success/10 px-2 py-0.5 text-label-sm font-medium text-success"
            >
              + {kw}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

/* ---------- interview questions ---------- */

const CATEGORY_LABEL: Record<Category, string> = {
  technical_depth: '技术深度',
  gap_probe: '空缺探测',
  soft_skill: '软技能',
  project_detail: '项目细节',
  scenario: '场景模拟',
}
const DIFFICULTY_STARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

function Questions({ questions }: { questions: InterviewQuestion[] }) {
  return (
    <section className="mx-auto mt-12 max-w-container px-6 md:px-12">
      <h2 className="text-headline-md">可能面临的面试问题</h2>
      <p className="mt-1 text-body-md text-foreground-variant">基于您的简历缺口生成</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {questions.map((q, i) => (
          <QuestionCard key={i} q={q} />
        ))}
      </div>
    </section>
  )
}

function QuestionCard({ q }: { q: InterviewQuestion }) {
  const stars = DIFFICULTY_STARS[q.difficulty] ?? 1
  return (
    <article className="flex h-full flex-col rounded border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-sm bg-surface-container px-2 py-0.5 text-label-sm text-foreground-variant">
          {CATEGORY_LABEL[q.category] ?? q.category}
        </span>
        <span className="text-label-sm text-foreground-variant">
          {'★'.repeat(stars)}
          <span className="text-outline-variant">{'★'.repeat(3 - stars)}</span>
        </span>
      </div>
      <h3 className="mt-3 text-title-lg text-foreground">{q.question}</h3>
      <p className="mt-3 text-label-md text-foreground-variant">考察点：{q.probe_point}</p>
      <p className="mt-2 flex-1 text-body-md text-foreground-variant">
        建议切入：{q.suggested_angle}
      </p>
    </article>
  )
}
