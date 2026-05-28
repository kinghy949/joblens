/**
 * Acceptance test for RewriterAgent.
 *
 * Loads golden jd_struct + resume_struct + computes scores using selectRewriteTargets
 * to derive target_bullet_ids, then runs the rewriter.
 *
 * Usage: pnpm tsx scripts/test-rewriter.ts [runs=10] [provider=llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { RewriterAgent } from '../lib/agents/rewriter'
import { MatchScorerAgent } from '../lib/agents/match-scorer'
import {
  JDStruct,
  ResumeStruct,
  MatchScores,
  RewriterOutput,
} from '../lib/schemas'
import { selectRewriteTargets } from '../lib/schemas/rewrite'
import { collectAgentRun } from '../lib/agents/types'
import type { ProviderName } from '../lib/schemas'

async function main() {
  const runs = Number(process.argv[2] ?? '10')
  const provider = (process.argv[3] as ProviderName) ?? 'llama'

  const goldenPath = path.join(process.cwd(), 'fixtures/golden-result.json')
  const golden = JSON.parse(await fs.readFile(goldenPath, 'utf-8'))
  const jd = JDStruct.parse(golden.jd_struct)
  const resume = ResumeStruct.parse(golden.resume_struct)

  /* We need MatchScores for selectRewriteTargets. Either reuse a cached one
   * or run MatchScorer once at the start of the test run. Caching to keep
   * the test deterministic + fast. */
  let scores: typeof MatchScores._type
  const scoresCache = path.join(process.cwd(), 'fixtures/.scores-cache.json')
  try {
    scores = MatchScores.parse(
      JSON.parse(await fs.readFile(scoresCache, 'utf-8')),
    )
    console.log('[test-rewriter] reusing cached MatchScores')
  } catch {
    console.log('[test-rewriter] computing fresh MatchScores ...')
    const stream = MatchScorerAgent.run({ jd, resume }, { provider })
    scores = (await collectAgentRun(stream)).final
    await fs.writeFile(scoresCache, JSON.stringify(scores, null, 2), 'utf-8')
  }

  const targetIds = selectRewriteTargets(resume.bullets, jd, scores)
  console.log(`[test-rewriter] target_bullet_ids: ${JSON.stringify(targetIds)} (${targetIds.length})\n`)

  if (targetIds.length === 0) {
    console.error('selectRewriteTargets returned empty — bad fixture or scoring')
    process.exit(1)
  }

  console.log(`[test-rewriter] provider=${provider} runs=${runs}\n`)

  type RunStat = {
    idx: number
    ok: boolean
    ms: number
    n_rewrites?: number
    ids_match?: boolean
    impact_dist?: string
    error?: string
  }
  const stats: RunStat[] = []

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now()
    try {
      const stream = RewriterAgent.run(
        { jd, resume, target_bullet_ids: targetIds },
        { provider },
      )
      const { final } = await collectAgentRun(stream)
      RewriterOutput.parse(final)

      const returnedIds = new Set(final.rewrites.map((r) => r.bullet_id))
      const targetSet = new Set(targetIds)
      const ids_match =
        targetIds.every((id) => returnedIds.has(id)) &&
        final.rewrites.every((r) => targetSet.has(r.bullet_id))

      /* Acceptance:
       * 1. rewrites.length >= 50% of targetIds (model may merge or skip some)
       * 2. all returned bullet_ids ∈ target_bullet_ids
       * 3. every rewritten has non-empty reason
       * 4. impact distribution: at least one major or moderate
       */
      const minRewrites = Math.ceil(targetIds.length * 0.5)
      const allValidImpact = final.rewrites.every((r) =>
        ['minor', 'moderate', 'major'].includes(r.impact),
      )
      const hasReasons = final.rewrites.every((r) => r.reason.length >= 10)
      const hasImpactful = final.rewrites.some(
        (r) => r.impact === 'major' || r.impact === 'moderate',
      )

      const ok =
        final.rewrites.length >= minRewrites &&
        final.rewrites.every((r) => targetSet.has(r.bullet_id)) &&
        allValidImpact &&
        hasReasons &&
        hasImpactful

      const dist = final.rewrites.reduce<Record<string, number>>((acc, r) => {
        acc[r.impact] = (acc[r.impact] ?? 0) + 1
        return acc
      }, {})

      stats.push({
        idx: i + 1,
        ok,
        ms: Date.now() - t0,
        n_rewrites: final.rewrites.length,
        ids_match,
        impact_dist: JSON.stringify(dist),
        error: ok
          ? undefined
          : `n=${final.rewrites.length}/${minRewrites} ids_match=${ids_match} impactful=${hasImpactful} reasons=${hasReasons}`,
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
    `last run:  ${last?.n_rewrites} rewrites, ids_match=${last?.ids_match}, dist=${last?.impact_dist}`,
  )

  if (failed.length > 0) {
    console.log('\n=== failures ===')
    for (const f of failed) {
      console.log(`run #${f.idx} (${f.ms}ms): ${f.error}`)
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
