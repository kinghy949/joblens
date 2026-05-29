import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata = {
  title: '隐私 · JobLens',
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-16 md:px-12">
          <h1 className="text-display">隐私说明</h1>
          <p className="mt-3 text-body-md text-foreground-variant">
            最后更新：2026-05-29
          </p>

          <Section title="一句话总结">
            <p>
              JobLens 不存储你的简历原文。文件上传后只在内存里跑解析，
              结果默认只存在你的浏览器；只有你主动点 &ldquo;生成分享链接&rdquo;，
              结构化分析才会落库，24 小时后自动删除。
            </p>
          </Section>

          <Section title="什么会被发送出去">
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>给 LLM Provider</strong>（默认 NVIDIA NIM，备选
                Anthropic Claude）：JD 文本、简历解析后的纯文本。
                通过 HTTPS 加密传输。Provider 自身的隐私政策由其负责，
                JobLens 不在其之上做额外处理。
              </li>
              <li>
                <strong>给本服务器</strong>：文件本体（用于解析），
                仅在请求生命周期内驻留内存。
              </li>
            </ul>
          </Section>

          <Section title="什么会被持久化">
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>不会自动存储任何分析内容</strong>。分析结束后，
                结果只放在你浏览器的 sessionStorage（关闭标签页就没了）。
              </li>
              <li>
                <strong>只有你主动生成分享链接</strong>，结构化分析（不含
                简历原文）才会写入 Postgres 的 `shared_results` 表，
                24 小时后由后台 cron 容器自动删除。
              </li>
              <li>
                生产环境每日做一次 Postgres 全量 `pg_dump`
                备份并保留 7 天，备份存在服务器本地磁盘。
              </li>
            </ul>
          </Section>

          <Section title="服务端日志的脱敏">
            <p>
              所有结构化日志（`pino`）配置了 redact 规则，明确把
              <code className="mx-1 rounded bg-surface-container-low px-1 font-mono text-foreground">
                jd_text
              </code>
              和
              <code className="mx-1 rounded bg-surface-container-low px-1 font-mono text-foreground">
                resume_text
              </code>
              字段替换为
              <code className="mx-1 rounded bg-surface-container-low px-1 font-mono text-foreground">
                [REDACTED]
              </code>
              。简历正文永远不会出现在 `docker logs` 或落盘日志里。
            </p>
          </Section>

          <Section title="分享链接的访问控制">
            <p>
              分享链接的 ID 是 12 字符的 URL-safe nanoid（约 56 bits 熵），
              在不被泄露的前提下不可猜测。但任何拿到 URL 的人都可以查看，
              没有额外鉴权。如果你担心被他人看到，不要生成分享链接，
              直接截图保留。
            </p>
          </Section>

          <Section title="开放源代码">
            <p>
              整个服务（前后端 + 部署配置）开源在 GitHub。
              你可以自行审计、私有部署，或在自己控制的服务器上运行：
            </p>
            <p className="mt-2">
              <Link
                href="https://github.com/kinghy949/joblens"
                target="_blank"
                className="text-foreground underline underline-offset-2"
              >
                github.com/kinghy949/joblens
              </Link>
            </p>
          </Section>

          <Section title="联系">
            <p>
              对隐私实现有疑问或建议？{' '}
              <Link href="/contact" className="text-foreground underline underline-offset-2">
                联系方式
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
