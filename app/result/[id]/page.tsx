import { Suspense } from 'react'
import { SiteHeader } from '@/components/site-header'
import { ResultView } from './result-view'

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader showLogin />
      <Suspense fallback={null}>
        <ResultView id={id} />
      </Suspense>
    </div>
  )
}
