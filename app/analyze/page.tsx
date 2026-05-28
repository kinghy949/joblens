import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { AnalyzeForm } from './analyze-form'

export default function AnalyzePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <Suspense fallback={null}>
        <AnalyzeForm />
      </Suspense>
    </div>
  )
}
