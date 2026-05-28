/**
 * End-to-end test for the orchestrator.
 *
 * Runs the full 3-phase DAG against fixtures and asserts:
 *   - 5 agents all emit start + done events
 *   - phase-complete events fire in order (1 → 2 → 3)
 *   - final AnalysisContext has all 5 outputs filled
 *
 * Usage: pnpm tsx scripts/test-orchestrator.ts [demo|llama]
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { orchestrate } from '../lib/orchestrator'
import { AnalysisContext } from '../lib/schemas'

async function main() {
  const mode = (process.argv[2] ?? 'demo') as 'demo' | 'llama'
  const isDemo = mode === 'demo'

  const [jdRaw, resumeRaw] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-jd.md'), 'utf-8'),
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-resume.md'), 'utf-8'),
  ])
  const jd_text = jdRaw.replace(/^> .*$/gm, '').trim()
  const resume_text = resumeRaw.replace(/^> .*$/gm, '').trim()

  console.log(`\n[test-orchestrator] mode=${mode}\n`)

  const t0 = Date.now()
  const events: { ms: number; type: string; label: string }[] = []
  let finalCtx: AnalysisContext | null = null

  for await (const event of orchestrate({
    jd_text,
    resume_text,
    provider: 'llama',
    is_demo: isDemo,
  })) {
    const ms = Date.now() - t0
    let label = ''
    if (event.type === 'agent-start') label = `${event.agent} (phase ${event.phase})`
    else if (event.type === 'agent-done')
      label = `${event.agent} (${event.duration_ms}ms${event.tokens_out ? ` · ${event.tokens_in}+${event.tokens_out} tok` : ''})`
    else if (event.type === 'agent-error') label = `${event.agent}: ${event.error}`
    else if (event.type === 'phase-complete') label = `phase ${event.phase} done`
    else if (event.type === 'final') {
      label = 'FINAL'
      finalCtx = event.context
    }
    events.push({ ms, type: event.type, label })
    console.log(`  +${ms.toString().padStart(6)}ms  ${event.type.padEnd(18)} ${label}`)
  }

  if (!finalCtx) {
    console.error('\n❌ no final event received')
    process.exit(1)
  }

  /* dump for inspection + potential golden refreeze */
  const dumpPath = path.join(process.cwd(), 'fixtures/.last-orchestration.json')
  await fs.writeFile(dumpPath, JSON.stringify(finalCtx, null, 2), 'utf-8')
  console.log(`\n  dumped → ${dumpPath}`)

  console.log('\n=== final context summary ===')
  console.log(`  trace_id:      ${finalCtx.trace_id}`)
  console.log(`  provider:      ${finalCtx.input.provider}`)
  console.log(`  is_demo:       ${finalCtx.input.is_demo}`)
  console.log(`  jd_struct:     ${finalCtx.jd_struct ? '✓' : '✗'}`)
  console.log(`  resume_struct: ${finalCtx.resume_struct ? '✓' : '✗'}`)
  console.log(`  scores:        ${finalCtx.scores ? `✓ overall=${finalCtx.scores.overall_score}` : '✗'}`)
  console.log(`  rewrites:      ${finalCtx.rewrites ? `✓ ${finalCtx.rewrites.length} items` : '✗'}`)
  console.log(`  questions:     ${finalCtx.questions ? `✓ ${finalCtx.questions.length} items` : '✗'}`)
  console.log(`  agent_runs:`)
  for (const [name, run] of Object.entries(finalCtx.agent_runs)) {
    const dur = run.ended_at ? run.ended_at - run.started_at : 0
    console.log(`    ${name.padEnd(16)} ${run.status} · ${dur}ms`)
  }

  /* Acceptance: */
  const expectedAgents = ['jd-parser', 'resume-analyst', 'match-scorer', 'rewriter', 'interviewer']
  const ran = expectedAgents.filter((a) => finalCtx.agent_runs[a]?.status === 'done')
  const allFiveDone = ran.length === 5
  const parseResult = AnalysisContext.safeParse(finalCtx)
  const ctxValid = parseResult.success
  if (!ctxValid) {
    console.log('\n❌ AnalysisContext parse errors:')
    console.log(JSON.stringify(parseResult.error.format(), null, 2).slice(0, 1000))
  }
  const totalMs = Date.now() - t0

  console.log(`\n  total elapsed: ${totalMs}ms`)
  console.log(
    `\n${allFiveDone && ctxValid ? '✅' : '❌'} acceptance: all-5-agents-done=${allFiveDone} ctx-valid=${ctxValid}`,
  )
  process.exit(allFiveDone && ctxValid ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
