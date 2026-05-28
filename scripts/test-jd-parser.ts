/**
 * Acceptance test for JDParserAgent.
 * Runs the agent N times against fixtures/demo-jd.md and reports:
 *   - schema validation pass rate
 *   - latency (P50/P95)
 *   - tokens / cost
 *
 * Usage: pnpm tsx scripts/test-jd-parser.ts [runs=10] [provider=llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { JDParserAgent } from '../lib/agents/jd-parser'
import { JDStruct } from '../lib/schemas'
import { collectAgentRun } from '../lib/agents/types'
import type { ProviderName } from '../lib/schemas'

async function main() {
  const runs = Number(process.argv[2] ?? '10')
  const provider = (process.argv[3] as ProviderName) ?? 'llama'

  const jdPath = path.join(process.cwd(), 'fixtures/demo-jd.md')
  const jdText = (await fs.readFile(jdPath, 'utf-8'))
    // strip the leading "> note" block in the fixture
    .replace(/^> .*$/gm, '')
    .trim()

  console.log(
    `\n[test-jd-parser] provider=${provider} runs=${runs} fixture=fixtures/demo-jd.md\n`,
  )

  type RunStat = {
    idx: number
    ok: boolean
    ms: number
    partials: number
    tokens?: number
    error?: string
    sample?: Partial<{
      role_title: string
      seniority: string
      hard_skills_count: number
      keywords_count: number
      hidden_count: number
    }>
  }
  const stats: RunStat[] = []

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now()
    try {
      const result = JDParserAgent.run(
        { jd_text: jdText, locale: 'zh' },
        { provider },
      )
      const { final, partials, usage } = await collectAgentRun(result)
      JDStruct.parse(final)
      stats.push({
        idx: i + 1,
        ok: true,
        ms: Date.now() - t0,
        partials,
        tokens: usage.totalTokens,
        sample: {
          role_title: final.role_title,
          seniority: final.seniority,
          hard_skills_count: final.hard_skills.length,
          keywords_count: final.keywords.length,
          hidden_count: final.hidden_requirements.length,
        },
      })
      process.stdout.write('.')
    } catch (err) {
      stats.push({
        idx: i + 1,
        ok: false,
        ms: Date.now() - t0,
        partials: 0,
        error: (err as Error).message,
      })
      process.stdout.write('x')
    }
  }
  console.log('\n')

  /* Aggregate */
  const passed = stats.filter((s) => s.ok)
  const failed = stats.filter((s) => !s.ok)
  const latencies = passed.map((s) => s.ms).sort((a, b) => a - b)
  const p = (q: number) =>
    latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))]
      : 0
  const avgTokens = passed.reduce((a, s) => a + (s.tokens ?? 0), 0) / (passed.length || 1)
  const avgPartials = passed.reduce((a, s) => a + s.partials, 0) / (passed.length || 1)

  console.log('=== results ===')
  console.log(`pass rate:   ${passed.length}/${runs}`)
  console.log(`latency:     P50 ${p(0.5)}ms · P95 ${p(0.95)}ms · max ${latencies.at(-1) ?? 0}ms`)
  console.log(`tokens avg:  ${Math.round(avgTokens)}`)
  console.log(`partials avg: ${Math.round(avgPartials)} (>3 means truly incremental)`)

  if (failed.length > 0) {
    console.log('\n=== failures ===')
    for (const f of failed) {
      console.log(`run #${f.idx}: ${f.error}`)
    }
  }

  if (passed.length > 0) {
    console.log('\n=== sample output (last run) ===')
    console.log(JSON.stringify(passed.at(-1)?.sample, null, 2))
  }

  /* Acceptance threshold per Issue #4: ≥ 8/10 (Llama) */
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
