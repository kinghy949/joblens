import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-outline-variant bg-background">
      <div className="mx-auto flex max-w-container flex-col items-center justify-between gap-2 px-6 py-6 text-label-md text-foreground-variant md:flex-row md:px-12">
        <div>
          © 2024 JobLens AI. All rights reserved.
          <span className="mx-2 text-outline-variant">|</span>
          MIT License
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="https://github.com/kinghy949/joblens"
            target="_blank"
            className="underline-offset-2 hover:underline"
          >
            GitHub
          </Link>
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            隐私
          </Link>
          <Link href="/contact" className="underline-offset-2 hover:underline">
            联系
          </Link>
        </div>
      </div>
    </footer>
  )
}
