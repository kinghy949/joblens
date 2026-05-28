import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'

export default function ExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10 text-foreground">
              <circle cx="12" cy="13" r="8" />
              <path strokeLinecap="round" d="M12 9v4l2 2M5 5l-2 2M19 5l2 2M9 2h6" />
              <path strokeLinecap="round" d="M3 3l18 18" />
            </svg>
          </div>
          <h1 className="mt-8 text-display">这份分析报告已过期</h1>
          <p className="mt-4 text-body-lg text-foreground-variant">
            为了保护简历隐私，所有分享链接 24 小时后自动从服务器删除。如果你想看到一份新的分析，可以再上传一次。
          </p>
          <div className="mt-10">
            <Link
              href="/analyze"
              className="inline-flex h-14 items-center rounded bg-primary px-10 text-body-lg font-medium text-primary-foreground transition hover:opacity-90"
            >
              分析一份新的 →
            </Link>
          </div>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-body-md text-foreground-variant hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回首页
            </Link>
          </div>
          <div className="mt-16 border-t border-outline-variant pt-6">
            <p className="text-label-md text-foreground-variant">
              JobLens 不存储简历原文，只在分析完成后生成可分享的结构化报告。
            </p>
          </div>
        </div>
      </main>
      <footer className="border-t border-outline-variant py-6 text-center text-label-md text-foreground-variant">
        © 2024 JobLens AI. All rights reserved.
      </footer>
    </div>
  )
}
