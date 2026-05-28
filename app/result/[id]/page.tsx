import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { ResultView } from './result-view'

export default function ResultPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader showLogin />
      <Suspense fallback={null}>
        <ResultView />
      </Suspense>
    </div>
  )
}
