import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { RadarChart } from '@/components/radar-chart'

export default function ResultPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader showLogin />

      <main className="flex-1 pb-32">
        {/* Hero score */}
        <section className="mx-auto max-w-container px-6 pt-12 md:px-12">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
            {/* Left: big score */}
            <div className="md:col-span-7">
              <div className="flex items-center gap-8">
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-foreground">
                  <span className="text-[64px] font-semibold leading-none tracking-tight">
                    78
                  </span>
                </div>
                <div>
                  <span className="inline-flex items-center rounded bg-foreground px-2.5 py-0.5 text-label-md font-medium text-background">
                    GRADE B+
                  </span>
                </div>
              </div>
              <h1 className="mt-8 text-headline-lg text-foreground">
                稳进面试，但需补强 LLM 项目叙述
              </h1>
              <p className="mt-2 max-w-xl text-body-md text-foreground-variant">
                您的简历在基础技术栈匹配度较高，但有高级职位要求的系统设计和具体可量化指标上仍有明显短板。
              </p>
            </div>
            {/* Right: radar */}
            <div className="flex items-center justify-center md:col-span-5">
              <RadarChart
                size={300}
                data={[
                  { label: '技术匹配', value: 85 },
                  { label: '经验', value: 72 },
                  { label: '项目相关', value: 65 },
                  { label: '沟通', value: 80 },
                  { label: '亮点稀缺度', value: 70 },
                ]}
              />
            </div>
          </div>
        </section>

        {/* Keyword coverage */}
        <section className="mx-auto mt-16 max-w-container px-6 md:px-12">
          <div className="flex items-baseline gap-3">
            <h2 className="text-headline-md">关键词覆盖</h2>
            <span className="text-body-md text-foreground-variant">
              JD 18 个关键词，命中 13 个
            </span>
          </div>

          <KeywordRow label="强匹配" tone="strong" items={['Python', '分布式', 'FastAPI', 'RabbitMQ', '微服务']} />
          <KeywordRow label="弱匹配" tone="weak" items={['k8s', 'Postgres']} />
          <KeywordRow label="未命中 (严重缺失)" tone="missing" items={['RAG', 'LLM', 'Function Calling', '向量数据库', 'leader']} />
        </section>

        <div className="my-12 border-t border-outline-variant" />

        {/* Action bar */}
        <section className="mx-auto max-w-container px-6 md:px-12">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-foreground-variant">
              本报告 24 小时后自动删除
            </span>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-foreground hover:bg-surface-container-low">
                <IconDownload /> 下载 PDF
              </button>
              <button className="inline-flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-foreground hover:bg-surface-container-low">
                <IconShare /> 生成分享链接
              </button>
              <button className="inline-flex items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-label-md text-foreground hover:bg-surface-container-low">
                再分析一份 →
              </button>
            </div>
          </div>
        </section>

        {/* Rewrites */}
        <section className="mx-auto mt-10 max-w-container px-6 md:px-12">
          <h2 className="text-headline-md">重构高分关键经历描述</h2>
          <div className="mt-6 space-y-4">
            <RewriteCard
              impact="HIGH IMPACT"
              before="负责公司订单 API 的开发与维护，使用 Python + FastAPI。"
              after="主导设计并发订单 API（Python/FastAPI），日均处理 200 万请求，核心接口 p99 时延稳定在 < 80ms。"
              reason="JD 强调'高并发场景经验'，原文几乎不具备多维度规模和性能描述。添加日均请求量和 p99 时延数据直观呈现工程能力。"
            />
            <RewriteCard
              impact="MEDIUM IMPACT"
              title="补充 LLM 相关技术栈关键词"
              reason="在您的'内部团队工具'中，未提及具体使用的模型和框架，建议补充…"
              expandable
            />
          </div>
        </section>

        {/* Interview questions */}
        <section className="mx-auto mt-12 max-w-container px-6 md:px-12">
          <h2 className="text-headline-md">可能面临的面试问题</h2>
          <p className="mt-1 text-body-md text-foreground-variant">
            基于您的简历缺口生成
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuestionCard
              tag="场景设计"
              difficulty={3}
              question="如果订单 API 的流量突然增加 10 倍，你的架构如何应对？"
              hint="考察高可用架构设计、降级限流策略和 FastAPI 在极限下的表现。"
            />
            <QuestionCard
              tag="技术深度"
              difficulty={4}
              question="解释 RabbitMQ 中的死信队列应用场景，以及你们项目是如何保证消息不丢失的？"
              hint="针对您简历中提到的 MQ 经验做深入探究，测试实践细节。"
            />
            <QuestionCard
              tag="AI 应用"
              difficulty={3}
              question="了解过 RAG（检索增强生成）吗？如果让你做我们系统的 RAG，你会怎么设计？"
              hint="JD 强烈要求，简历缺失，大概率会被问到以此判断学习能力和影响潜质。"
            />
          </div>
        </section>
      </main>
    </div>
  )
}

function KeywordRow({
  label,
  tone,
  items,
}: {
  label: string
  tone: 'strong' | 'weak' | 'missing'
  items: string[]
}) {
  const chipClass =
    tone === 'strong'
      ? 'border-outline-variant bg-surface-container-lowest text-foreground'
      : tone === 'weak'
        ? 'border-warning/30 bg-warning/10 text-warning'
        : 'border-destructive/30 bg-destructive/5 text-destructive line-through'
  return (
    <div className="mt-5">
      <p className="text-label-md text-foreground-variant">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-label-md ${chipClass}`}
          >
            {tone === 'strong' && <span className="text-success">✓</span>}
            {tone === 'weak' && <span>△</span>}
            {tone === 'missing' && <span>×</span>}
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function RewriteCard({
  impact,
  title,
  before,
  after,
  reason,
  expandable,
}: {
  impact: string
  title?: string
  before?: string
  after?: string
  reason: string
  expandable?: boolean
}) {
  return (
    <article className="rounded border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-title-lg">
          {title ?? '重构高分关键经历描述'}
        </h3>
        <span className="rounded bg-foreground px-2 py-0.5 text-label-sm font-medium text-background">
          {impact}
        </span>
      </div>

      {before && after && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border-l-2 border-destructive bg-surface-container-low p-4">
            <p className="text-label-sm uppercase tracking-wider text-destructive">
              ✗ 原文
            </p>
            <p className="mt-2 text-body-md text-foreground line-through decoration-destructive/40">
              {before}
            </p>
          </div>
          <div className="rounded border-l-2 border-success bg-surface-container-low p-4">
            <p className="text-label-sm uppercase tracking-wider text-success">
              ✓ 改写后
            </p>
            <p className="mt-2 text-body-md text-foreground">{after}</p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded border-l-2 border-foreground bg-surface-container-low p-4">
        <p className="text-label-md text-foreground-variant">💡 改写理由</p>
        <p className="mt-1 text-body-md text-foreground">{reason}</p>
      </div>

      {expandable && (
        <button className="mt-3 text-label-md text-foreground-variant underline-offset-2 hover:underline">
          展开详细分析与建议 ↓
        </button>
      )}
    </article>
  )
}

function QuestionCard({
  tag,
  difficulty,
  question,
  hint,
}: {
  tag: string
  difficulty: number
  question: string
  hint: string
}) {
  return (
    <article className="rounded border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-sm bg-surface-container px-2 py-0.5 text-label-sm text-foreground-variant">
          {tag}
        </span>
        <span className="text-label-sm text-foreground-variant">
          {'★'.repeat(difficulty)}
          <span className="text-outline-variant">
            {'★'.repeat(5 - difficulty)}
          </span>
        </span>
      </div>
      <h3 className="mt-3 text-title-lg text-foreground">{question}</h3>
      <p className="mt-3 text-body-md text-foreground-variant">{hint}</p>
    </article>
  )
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  )
}
function IconShare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}
