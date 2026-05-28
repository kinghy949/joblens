'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RadarChart } from '@/components/radar-chart'

type StoredResult = {
  trace_id?: string
  is_demo?: boolean
  jd_struct?: {
    role_title?: string
    seniority?: string
    keywords?: string[]
    hard_skills?: { name: string; level: string }[]
    one_liner?: string
  } | null
  resume_struct?: {
    candidate_name?: string
    experience_years?: number
    bullets?: { id: string; text: string; has_metrics: boolean }[]
    highlights?: { point: string; why_strong: string }[]
    weaknesses?: { point: string; severity: 'low' | 'medium' | 'high' }[]
  } | null
}

export function ResultView() {
  const [data, setData] = useState<StoredResult | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('joblens.analyze.result')
    if (!raw) {
      setMissing(true)
      return
    }
    try {
      setData(JSON.parse(raw) as StoredResult)
    } catch {
      setMissing(true)
    }
  }, [])

  if (missing) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-headline-lg">没找到分析结果</h1>
          <p className="mt-3 text-body-md text-foreground-variant">
            可能是因为你直接打开了这个链接 / 刷新了浏览器 / 关闭了标签页。
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

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-body-md text-foreground-variant">加载中…</p>
      </main>
    )
  }

  const jd = data.jd_struct ?? {}
  const resume = data.resume_struct ?? {}
  const bullets = resume.bullets ?? []
  const highlights = resume.highlights ?? []
  const weaknesses = resume.weaknesses ?? []
  const withMetrics = bullets.filter((b) => b.has_metrics).length

  const techScore = Math.min(100, 60 + (jd.hard_skills?.length ?? 0) * 2)
  const expScore = Math.min(100, 50 + (resume.experience_years ?? 0) * 8)
  const projScore = Math.min(100, 50 + bullets.length * 3)
  const commScore = bullets.length > 0 ? Math.round((withMetrics / bullets.length) * 100) : 50
  const uniqScore = Math.min(100, 50 + highlights.length * 8)
  const overall = Math.round(
    0.3 * techScore + 0.2 * expScore + 0.2 * projScore + 0.15 * commScore + 0.15 * uniqScore,
  )
  const grade = overall >= 90 ? 'S' : overall >= 80 ? 'A' : overall >= 70 ? 'B+' : overall >= 60 ? 'C' : 'D'

  return (
    <main className="flex-1 pb-24">
      {data.is_demo && (
        <div className="border-b border-outline-variant bg-surface-container-low">
          <div className="mx-auto flex max-w-container items-center justify-between px-6 py-2 md:px-12">
            <span className="text-label-md text-foreground-variant">
              🎬 Demo 模式 — 内容来自冻结的示例结果（fixtures/golden-result.json）
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
                <span className="text-[64px] font-semibold leading-none tracking-tight">{overall}</span>
              </div>
              <div>
                <span className="inline-flex items-center rounded bg-foreground px-2.5 py-0.5 text-label-md font-medium text-background">
                  GRADE {grade}
                </span>
              </div>
            </div>
            <h1 className="mt-8 text-headline-lg text-foreground">{jd.one_liner ?? '岗位定位分析'}</h1>
            <p className="mt-2 max-w-xl text-body-md text-foreground-variant">
              {jd.role_title ? `针对 "${jd.role_title}" 岗位` : '岗位'} 的初步匹配评估。
              Week 2 将加入更精细的多维度评分与改写建议。
            </p>
          </div>

          <div className="flex items-center justify-center md:col-span-5">
            <RadarChart
              size={300}
              data={[
                { label: '技术匹配', value: techScore },
                { label: '经验', value: expScore },
                { label: '项目相关', value: projScore },
                { label: '沟通', value: commScore },
                { label: '亮点稀缺度', value: uniqScore },
              ]}
            />
          </div>
        </div>
      </section>

      {/* JD insights */}
      <section className="mx-auto mt-16 max-w-container px-6 md:px-12">
        <h2 className="text-headline-md">JD 解析结果</h2>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded border border-outline-variant bg-surface-container-lowest p-5">
            <p className="text-label-md text-foreground-variant">岗位 · 级别</p>
            <p className="mt-1 text-title-lg text-foreground">
              {jd.role_title ?? '—'} {jd.seniority ? `· ${jd.seniority}` : ''}
            </p>
          </div>
          <div className="rounded border border-outline-variant bg-surface-container-lowest p-5">
            <p className="text-label-md text-foreground-variant">硬技能</p>
            <p className="mt-1 text-title-lg text-foreground">
              {jd.hard_skills?.length ?? 0} 项 · 关键词 {jd.keywords?.length ?? 0} 个
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(jd.keywords ?? []).slice(0, 20).map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center rounded border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-label-md text-foreground"
            >
              {kw}
            </span>
          ))}
        </div>
      </section>

      {/* Resume insights */}
      <section className="mx-auto mt-16 max-w-container px-6 md:px-12">
        <h2 className="text-headline-md">简历分析结果</h2>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Tile label="经历" value={`${bullets.length} 条`} />
          <Tile label="含量化指标" value={`${withMetrics} / ${bullets.length}`} />
          <Tile label="弱项" value={`${weaknesses.length} 个`} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="rounded border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="text-title-lg">亮点</h3>
            <ul className="mt-3 space-y-3">
              {highlights.length === 0 && (
                <li className="text-body-md text-foreground-variant">未检测到亮点</li>
              )}
              {highlights.map((h, i) => (
                <li key={i} className="border-l-2 border-success pl-3">
                  <p className="text-body-md text-foreground">{h.point}</p>
                  <p className="mt-1 text-label-md text-foreground-variant">{h.why_strong}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="text-title-lg">弱项</h3>
            <ul className="mt-3 space-y-3">
              {weaknesses.length === 0 && (
                <li className="text-body-md text-foreground-variant">未检测到明显弱项</li>
              )}
              {weaknesses.map((w, i) => (
                <li key={i} className={`border-l-2 pl-3 ${severityBorder(w.severity)}`}>
                  <p className="text-body-md text-foreground">{w.point}</p>
                  <p className="mt-1 text-label-md text-foreground-variant">
                    严重程度：{severityLabel(w.severity)}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-container px-6 md:px-12">
        <div className="rounded border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
          <p className="text-body-md text-foreground-variant">
            ⏳ Week 2 将加入：关键词覆盖热力图 · 逐句改写 diff · 模拟面试官追问。
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-container px-6 md:px-12">
        <div className="flex items-center justify-between border-t border-outline-variant pt-6">
          <span className="text-label-md text-foreground-variant">
            trace_id: {data.trace_id ? data.trace_id : '—'}
          </span>
          <Link href="/analyze" className="text-label-md text-foreground underline-offset-2 hover:underline">
            再分析一份 →
          </Link>
        </div>
      </section>
    </main>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-outline-variant bg-surface-container-lowest p-5">
      <p className="text-label-md text-foreground-variant">{label}</p>
      <p className="mt-1 text-headline-md text-foreground">{value}</p>
    </div>
  )
}

function severityBorder(s: 'low' | 'medium' | 'high') {
  return s === 'high'
    ? 'border-destructive'
    : s === 'medium'
      ? 'border-warning'
      : 'border-outline-variant'
}
function severityLabel(s: 'low' | 'medium' | 'high') {
  return s === 'high' ? '高（关键缺失）' : s === 'medium' ? '中（可优化）' : '低（用词层面）'
}
