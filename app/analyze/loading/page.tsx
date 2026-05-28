import { Suspense } from 'react'
import { AnalysisRunner } from './analysis-runner'

export const dynamic = 'force-dynamic'

export default function AnalyzeLoadingPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisRunner />
    </Suspense>
  )
}
