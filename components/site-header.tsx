import Link from 'next/link'

type Props = {
  showLogin?: boolean
  variant?: 'default' | 'minimal'
}

export function SiteHeader({ showLogin = true, variant = 'default' }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-outline-variant bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-container items-center justify-between px-6 md:px-12">
        <Link
          href="/"
          className="text-headline-md text-foreground tracking-tight"
        >
          JobLens
        </Link>
        {variant === 'default' && (
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#how"
              className="text-body-md text-foreground-variant transition-colors hover:text-foreground"
            >
              工作原理
            </Link>
            <Link
              href="https://github.com/kinghy949/joblens"
              target="_blank"
              rel="noreferrer"
              className="text-body-md text-foreground-variant transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
          </nav>
        )}
        {showLogin ? (
          <button className="rounded border border-outline-variant px-4 py-1.5 text-body-md text-foreground transition hover:bg-surface-container-low">
            登录
          </button>
        ) : (
          <span />
        )}
      </div>
    </header>
  )
}
