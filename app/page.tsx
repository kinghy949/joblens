export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-semibold tracking-tight">JobLens</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          你的简历，配不上这份 JD 吗？让 4 个 AI 一起告诉你怎么改。
        </p>
        <div className="mt-10">
          <a
            href="/analyze?demo=1"
            className="inline-flex h-12 items-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground transition hover:opacity-90"
          >
            立即试用 — 无需登录
          </a>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">🚧 V1 开发中</p>
      </div>
    </main>
  )
}
