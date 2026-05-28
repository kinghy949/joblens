import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const steps = [
  {
    n: '步骤 1',
    title: 'JD 解析',
    desc: '提取硬技能、软技能、隐藏要求',
    icon: 'document_scanner',
  },
  {
    n: '步骤 2',
    title: '简历分析',
    desc: '识别亮点和需要改写的弱项',
    icon: 'manage_search',
  },
  {
    n: '步骤 3',
    title: '匹配打分',
    desc: '5 维度雷达图 + 关键词覆盖',
    icon: 'track_changes',
  },
  {
    n: '步骤 4',
    title: '改写 + 提问',
    desc: '逐 bullet diff + 模拟面试官追问',
    icon: 'file_copy',
  },
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-container px-6 pt-24 pb-16 text-center md:px-12 md:pt-32">
          <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-label-md text-foreground-variant">
            多 Agent 协作 · 中文优先
          </span>

          <h1 className="mt-6 text-[40px] font-semibold tracking-tight leading-[1.15] md:text-[56px]">
            你的简历，配不上这份 JD 吗？
          </h1>
          <p className="mt-3 text-headline-lg text-foreground-variant">
            让 4 个 AI 一起告诉你怎么改。
          </p>

          <p className="mx-auto mt-8 max-w-xl text-body-lg text-foreground-variant">
            粘贴 JD、上传简历，30 秒看到匹配度雷达图、逐句改写建议、面试官追问。
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/analyze?demo=1"
              className="inline-flex h-12 items-center rounded bg-primary px-8 text-body-md font-medium text-primary-foreground transition hover:opacity-90"
            >
              立即试用 — 无需登录
            </Link>
            <Link
              href="#demo-video"
              className="inline-flex h-12 items-center rounded border border-outline-variant bg-surface-container-lowest px-8 text-body-md font-medium text-foreground transition hover:bg-surface-container-low"
            >
              看 30 秒 demo →
            </Link>
          </div>
        </section>

        {/* Demo video placeholder */}
        <section id="demo-video" className="mx-auto max-w-container px-6 pb-20 md:px-12">
          <div className="mx-auto max-w-3xl">
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-outline-variant bg-surface-container">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-lowest border border-outline-variant">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-1 h-6 w-6 text-foreground"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-label-md text-foreground-variant">
              30 秒看完核心体验
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-outline-variant">
          <div className="mx-auto max-w-container px-6 py-16 md:px-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
              {steps.map((s) => (
                <div key={s.title}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest">
                    <StepIcon name={s.icon} />
                  </div>
                  <p className="mt-3 text-label-md text-foreground-variant">
                    {s.n}
                  </p>
                  <h3 className="mt-1 text-title-lg text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-body-md text-foreground-variant">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function StepIcon({ name }: { name: string }) {
  const common = 'h-5 w-5 text-foreground'
  if (name === 'document_scanner') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    )
  }
  if (name === 'manage_search') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={common}>
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
      </svg>
    )
  }
  if (name === 'track_changes') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={common}>
      <rect x="8" y="4" width="12" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4V2H6a2 2 0 00-2 2v14h2" />
    </svg>
  )
}
