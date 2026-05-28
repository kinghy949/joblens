/**
 * Acceptance test for ResumeAnalystAgent.
 * Runs the agent against fixtures/demo-resume.md and validates:
 *   - schema validation pass
 *   - bullets count ≥ 5
 *   - highlights ≥ 3, weaknesses ≥ 3
 *   - has_metrics=false bullets ≥ 3 (validates the fixture's intended pain points)
 *
 * Usage: pnpm tsx scripts/test-resume-analyst.ts [runs=10] [provider=llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ResumeAnalystAgent } from '../lib/agents/resume-analyst'
import { ResumeStruct } from '../lib/schemas'
import { collectAgentRun } from '../lib/agents/types'
import type { ProviderName } from '../lib/schemas'

async function main() {
  const runs = Number(process.argv[2] ?? '10')
  const provider = (process.argv[3] as ProviderName) ?? 'llama'

  const resumePath = path.join(process.cwd(), 'fixtures/demo-resume.md')
  const resumeText = (await fs.readFile(resumePath, 'utf-8'))
    .replace(/^> .*$/gm, '')
    .trim()

  console.log(
    `\n[test-resume-analyst] provider=${provider} runs=${runs} fixture=fixtures/demo-resume.md\n`,
  )

  type RunStat = {
    idx: number
    ok: boolean
    ms: number
    tokens?: number
    bullets?: number
    highlights?: number
    weaknesses?: number
    weakBullets?: number
    error?: string
  }
  const stats: RunStat[] = []

  for (let i = 0; i < runs; i++) {
    const t0 = Date.now()
    try {
      const result = ResumeAnalystAgent.run(
        { resume_text: resumeText, locale: 'zh' },
        { provider },
      )
      const { final, usage } = await collectAgentRun(result)
      ResumeStruct.parse(final)

      const weakBullets = final.bullets.filter((b) => !b.has_metrics).length

      const ok =
        final.bullets.length >= 5 &&
        final.highlights.length >= 3 &&
        final.weaknesses.length >= 3 &&
        weakBullets >= 3

      stats.push({
        idx: i + 1,
        ok,
        ms: Date.now() - t0,
        tokens: usage.totalTokens,
        bullets: final.bullets.length,
        highlights: final.highlights.length,
        weaknesses: final.weaknesses.length,
        weakBullets,
        error: ok ? undefined : 'sub-threshold counts',
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
    `last run:  bullets=${last?.bullets} highlights=${last?.highlights} weaknesses=${last?.weaknesses} weak_bullets=${last?.weakBullets}`,
  )

  if (failed.length > 0) {
    console.log('\n=== failures ===')
    for (const f of failed) {
      console.log(
        `run #${f.idx} (${f.ms}ms): ${f.error} [bullets=${f.bullets} hl=${f.highlights} wk=${f.weaknesses} wkBul=${f.weakBullets}]`,
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
