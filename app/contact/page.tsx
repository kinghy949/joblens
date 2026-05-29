import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: '联系 · JobLens',
}

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
          <h1 className="text-display">联系</h1>
          <p className="mt-3 text-body-md text-foreground-variant">
            JobLens 是一个开源项目，没有公司、没有客服。
            如果你想反馈问题、提需求或聊聊实现，下面是最有效的几条路径。
          </p>

          <Section title="GitHub Issues">
            <p>
              所有 bug、功能建议、设计讨论都欢迎在仓库 issues 留：
            </p>
            <p className="mt-2">
              <Link
                href="https://github.com/kinghy949/joblens/issues"
                target="_blank"
                className="text-foreground underline underline-offset-2"
              >
                github.com/kinghy949/joblens/issues
              </Link>
            </p>
          </Section>

          <Section title="Pull Requests">
            <p>
              PR 直接发，CI 全绿后我会尽快 review。涉及 prompt 改动的请同时跑
              <code className="mx-1 rounded bg-surface-container-low px-1 font-mono text-foreground">
                pnpm eval --runs 5
              </code>
              贴结果。
            </p>
          </Section>

          <Section title="隐私 / 数据相关">
            <p>
              涉及隐私 / 数据合规问题，请在 issue 标题前缀
              <code className="mx-1 rounded bg-surface-container-low px-1 font-mono text-foreground">
                [privacy]
              </code>
              方便优先看到。我们的隐私实现写在{' '}
              <Link href="/privacy" className="text-foreground underline underline-offset-2">
                隐私说明
              </Link>
              。
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-headline-md text-foreground">{title}</h2>
      <div className="mt-4 space-y-3 text-body-md leading-7 text-foreground-variant">{children}</div>
    </section>
  )
}
