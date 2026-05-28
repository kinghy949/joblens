/**
 * Acceptance test for MatchScorerAgent. Uses the frozen jd_struct +
 * resume_struct from fixtures/golden-result.json so we don't have to re-run
 * JDParser / ResumeAnalyst every iteration.
 *
 * Usage: pnpm tsx scripts/test-match-scorer.ts [runs=10] [provider=llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { MatchScorerAgent } from '../lib/agents/match-scorer'
import { JDStruct, ResumeStruct, MatchScores } from '../lib/schemas'
import { collectAgentRun } from '../lib/agents/types'
import type { ProviderName } from '../lib/schemas'

async function main() {
  const runs = Number(process.argv[2] ?? '10')
  const provider = (process.argv[3] as ProviderName) ?? 'llama'

  const goldenPath = path.join(process.cwd(), 'fixtures/golden-result.json')
  const golden = JSON.parse(await fs.readFile(goldenPath, 'utf-8'))
  const jd = JDStruct.parse(golden.jd_struct)
  const resume = ResumeStruct.parse(golden.resume_struct)

  console.log(
    `\n[test-match-scorer] provider=${provider} runs=${runs} ` +
      `fixture=fixtures/golden-result.json\n`,
  )

  type RunStat = {
    idx: number
    ok: boolean
    ms: number
    overall?: number
    grade?: string
    kw_total?: number
    kw_strong?: number
    kw_missing?: number
    error?: string
  }
  const stats: RunStat[] = []

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now()
    try {
      const stream = MatchScorerAgent.run({ jd, resume }, { provider })
      const { final } = await collectAgentRun(stream)
      MatchScores.parse(final)

      const kw_strong = final.keyword_coverage.filter((k) => k.hit === 'strong').length
      const kw_missing = final.keyword_coverage.filter((k) => k.hit === 'missing').length

      /* Acceptance:
       * 1. all 5 dim_scores in [0..100]
       * 2. overall_score within ±10 of weighted formula
       * 3. keyword_coverage covers ≥ 80% of JD keywords
       * 4. summary length ≤ 60
       */
      const dims = final.dim_scores
      const expected = Math.round(
        0.3 * dims.tech + 0.2 * dims.experience + 0.2 * dims.project +
          0.15 * dims.communication + 0.15 * dims.uniqueness,
      )
      const overallOk = Math.abs(final.overall_score - expected) <= 10
      const coverageRate = final.keyword_coverage.length / jd.keywords.length
      const summaryOk = final.summary.length <= 60

      const ok = overallOk && coverageRate >= 0.8 && summaryOk

      stats.push({
        idx: i + 1,
        ok,
        ms: Date.now() - t0,
        overall: final.overall_score,
        grade: final.grade,
        kw_total: final.keyword_coverage.length,
        kw_strong,
        kw_missing,
        error: ok
          ? undefined
          : `overallOk=${overallOk} coverageRate=${coverageRate.toFixed(2)} summaryOk=${summaryOk}`,
      })
      process.stdout.write(ok ? '.' : '?')
    } catch (err) {
      stats.push({
        idx: i + 1,
        ok: false,
        ms: Date.now() - t0,
        error: (err as Error).message,
      })
      process.stdout.write('x')
    }
  }
  console.log('\n')

  const passed = stats.filter((s) => s.ok)
  const failed = stats.filter((s) => !s.ok)
  const latencies = passed.map((s) => s.ms).sort((a, b) => a - b)
  const p = (q: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))]
      : 0
  const last = stats.at(-1)

  console.log('=== results ===')
  console.log(`pass rate: ${passed.length}/${runs}`)
  console.log(`latency:   P50 ${p(0.5)}ms · P95 ${p(0.95)}ms`)
  console.log(
    `last run:  overall=${last?.overall} grade=${last?.grade} kw=${last?.kw_total} (strong=${last?.kw_strong}, missing=${last?.kw_missing})`,
  )

  if (failed.length > 0) {
    console.log('\n=== failures ===')
    for (const f of failed) {
      console.log(
        `run #${f.idx} (${f.ms}ms): ${f.error} [overall=${f.overall} grade=${f.grade} kw=${f.kw_total}]`,
      )
    }
  }

  const minPass = provider === 'llama' ? Math.ceil(runs * 0.8) : runs
  const accept = passed.length >= minPass
  console.log(
    `\n${accept ? '✅' : '❌'} acceptance: ${passed.length}/${runs} ≥ ${minPass} (${provider})`,
  )
  process.exit(accept ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
