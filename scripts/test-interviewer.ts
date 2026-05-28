/**
 * Acceptance test for InterviewerAgent. Uses cached scores from
 * fixtures/.scores-cache.json (created by test-rewriter or test-match-scorer).
 *
 * Usage: pnpm tsx scripts/test-interviewer.ts [runs=10] [provider=llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { InterviewerAgent } from '../lib/agents/interviewer'
import { MatchScorerAgent } from '../lib/agents/match-scorer'
import {
  JDStruct,
  ResumeStruct,
  MatchScores,
  InterviewerOutput,
} from '../lib/schemas'
import { collectAgentRun } from '../lib/agents/types'
import type { ProviderName } from '../lib/schemas'

async function main() {
  const runs = Number(process.argv[2] ?? '10')
  const provider = (process.argv[3] as ProviderName) ?? 'llama'

  const goldenPath = path.join(process.cwd(), 'fixtures/golden-result.json')
  const golden = JSON.parse(await fs.readFile(goldenPath, 'utf-8'))
  const jd = JDStruct.parse(golden.jd_struct)
  const resume = ResumeStruct.parse(golden.resume_struct)

  let scores: typeof MatchScores._type
  const scoresCache = path.join(process.cwd(), 'fixtures/.scores-cache.json')
  try {
    scores = MatchScores.parse(JSON.parse(await fs.readFile(scoresCache, 'utf-8')))
    console.log('[test-interviewer] reusing cached MatchScores')
  } catch {
    console.log('[test-interviewer] computing fresh MatchScores ...')
    const stream = MatchScorerAgent.run({ jd, resume }, { provider })
    scores = (await collectAgentRun(stream)).final
    await fs.writeFile(scoresCache, JSON.stringify(scores, null, 2), 'utf-8')
  }

  console.log(`\n[test-interviewer] provider=${provider} runs=${runs}\n`)

  type RunStat = {
    idx: number
    ok: boolean
    ms: number
    n_qs?: number
    cats?: string
    error?: string
    sample?: string
  }
  const stats: RunStat[] = []

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now()
    try {
      const stream = InterviewerAgent.run({ jd, resume, scores }, { provider })
      const { final } = await collectAgentRun(stream)
      InterviewerOutput.parse(final)

      const cats = new Set(final.questions.map((q) => q.category))
      const allValidLength = final.questions.every(
        (q) =>
          q.question.length > 0 &&
          q.question.length <= 160 &&
          q.suggested_angle.length > 0 &&
          q.probe_point.length > 0,
      )
      const allOpenEnded = final.questions.every(
        (q) => !/^是不是|^对不对|^可以吗|^能吗/.test(q.question.trim()),
      )

      /* Acceptance:
       * 1. 3 <= n <= 5
       * 2. category diversity: at least 2 distinct categories
       * 3. at least 1 from {technical_depth, project_detail} AND at least
       *    1 from {gap_probe, scenario, soft_skill}
       * 4. all fields non-empty & open-ended
       */
      const hasDepth = final.questions.some(
        (q) => q.category === 'technical_depth' || q.category === 'project_detail',
      )
      const hasGapOrSoft = final.questions.some((q) =>
        ['gap_probe', 'soft_skill', 'scenario'].includes(q.category),
      )

      const ok =
        final.questions.length >= 3 &&
        final.questions.length <= 5 &&
        cats.size >= 2 &&
        hasDepth &&
        hasGapOrSoft &&
        allValidLength &&
        allOpenEnded

      stats.push({
        idx: i + 1,
        ok,
        ms: Date.now() - t0,
        n_qs: final.questions.length,
        cats: Array.from(cats).join(','),
        sample: final.questions[0]?.question,
        error: ok
          ? undefined
          : `n=${final.questions.length} cats=${Array.from(cats).join(',')} depth=${hasDepth} gap=${hasGapOrSoft} valid=${allValidLength} open=${allOpenEnded}`,
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
  console.log(`last run:  ${last?.n_qs} questions, categories=${last?.cats}`)
  if (last?.sample) console.log(`sample Q1: ${last.sample}`)

  if (failed.length > 0) {
    console.log('\n=== failures ===')
    for (const f of failed) console.log(`run #${f.idx} (${f.ms}ms): ${f.error}`)
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
