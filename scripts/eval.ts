/**
 * Eval framework: run all (or selected) agents N times against the fixtures
 * and print a regression-friendly summary table. Designed to be runnable
 * locally before commits AND from CI.
 *
 * Each per-agent harness (scripts/test-*.ts) already encodes its own pass
 * criteria. This script just orchestrates them, sleeps between runs to
 * avoid NIM RPM throttling, and aggregates into one table.
 *
 * Usage:
 *   pnpm eval                          # default: all 5 agents, 3 runs each
 *   pnpm eval --runs 10
 *   pnpm eval --agents jd-parser,resume-analyst
 *   pnpm eval --provider claude
 *   pnpm eval --ci                     # quieter output, non-zero exit on fail
 */
import 'dotenv/config'
import { spawn } from 'node:child_process'
import path from 'node:path'

type AgentName =
  | 'jd-parser'
  | 'resume-analyst'
  | 'match-scorer'
  | 'rewriter'
  | 'interviewer'

const ALL_AGENTS: AgentName[] = [
  'jd-parser',
  'resume-analyst',
  'match-scorer',
  'rewriter',
  'interviewer',
]

type Args = {
  runs: number
  agents: AgentName[]
  provider: 'llama' | 'claude'
  ci: boolean
  agentSleepMs: number
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    runs: 3,
    agents: ALL_AGENTS,
    provider: 'llama',
    ci: false,
    agentSleepMs: 5_000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--runs') out.runs = Number(argv[++i])
    else if (a === '--agents') {
      out.agents = argv[++i].split(',').map((x) => x.trim()) as AgentName[]
    } else if (a === '--provider') out.provider = argv[++i] as 'llama' | 'claude'
    else if (a === '--ci') out.ci = true
    else if (a === '--agent-sleep-ms') out.agentSleepMs = Number(argv[++i])
  }
  return out
}

type AgentResult = {
  agent: AgentName
  ok: boolean
  durationMs: number
  exitCode: number
  passRate?: { passed: number; total: number }
  latency?: { p50: number; p95: number }
}

const AGENT_TO_SCRIPT: Record<AgentName, string> = {
  'jd-parser': 'scripts/test-jd-parser.ts',
  'resume-analyst': 'scripts/test-resume-analyst.ts',
  'match-scorer': 'scripts/test-match-scorer.ts',
  rewriter: 'scripts/test-rewriter.ts',
  interviewer: 'scripts/test-interviewer.ts',
}

async function runOne(
  agent: AgentName,
  runs: number,
  provider: string,
  ci: boolean,
): Promise<AgentResult> {
  const script = AGENT_TO_SCRIPT[agent]
  const t0 = Date.now()
  return new Promise((resolve) => {
    const child = spawn(
      'pnpm',
      ['tsx', path.join(process.cwd(), script), String(runs), provider],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (b: Buffer) => {
      stdout += b.toString()
      if (!ci) process.stdout.write(b)
    })
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString()
      if (!ci) process.stderr.write(b)
    })
    child.on('close', (code) => {
      const durationMs = Date.now() - t0
      const passMatch = stdout.match(/pass rate:\s*(\d+)\/(\d+)/)
      const latMatch = stdout.match(/latency:\s+P50\s+(\d+)ms\s+·\s+P95\s+(\d+)ms/)
      void stderr
      resolve({
        agent,
        ok: code === 0,
        durationMs,
        exitCode: code ?? -1,
        passRate: passMatch
          ? { passed: Number(passMatch[1]), total: Number(passMatch[2]) }
          : undefined,
        latency: latMatch
          ? { p50: Number(latMatch[1]), p95: Number(latMatch[2]) }
          : undefined,
      })
    })
  })
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log(
    `\n[eval] runs=${args.runs} provider=${args.provider} agents=${args.agents.join(',')} ci=${args.ci}\n`,
  )

  const results: AgentResult[] = []
  for (let i = 0; i < args.agents.length; i++) {
    const agent = args.agents[i]
    if (!AGENT_TO_SCRIPT[agent]) {
      console.error(`unknown agent: ${agent}`)
      process.exit(1)
    }
    console.log(`▶ ${agent} (${i + 1}/${args.agents.length})`)
    const res = await runOne(agent, args.runs, args.provider, args.ci)
    results.push(res)

    /* Inter-agent sleep helps NIM RPM throttling settle between batches.
     * Skip after the last agent. */
    if (i < args.agents.length - 1) await sleep(args.agentSleepMs)
  }

  console.log('\n=== EVAL SUMMARY ===\n')
  console.log(
    pad('agent', 18) +
      pad('result', 8) +
      pad('passed', 10) +
      pad('P50 (s)', 10) +
      pad('P95 (s)', 10) +
      pad('elapsed (s)', 12),
  )
  console.log('─'.repeat(68))
  for (const r of results) {
    const passed = r.passRate ? `${r.passRate.passed}/${r.passRate.total}` : '—'
    const p50 = r.latency ? (r.latency.p50 / 1000).toFixed(1) : '—'
    const p95 = r.latency ? (r.latency.p95 / 1000).toFixed(1) : '—'
    const elapsed = (r.durationMs / 1000).toFixed(1)
    console.log(
      pad(r.agent, 18) +
        pad(r.ok ? '✅ PASS' : '❌ FAIL', 8) +
        pad(passed, 10) +
        pad(p50, 10) +
        pad(p95, 10) +
        pad(elapsed, 12),
    )
  }
  console.log('')

  const totalElapsed = results.reduce((a, r) => a + r.durationMs, 0) / 1000
  const failed = results.filter((r) => !r.ok)
  if (failed.length === 0) {
    console.log(`✅ ALL PASS · total ${totalElapsed.toFixed(1)}s\n`)
    process.exit(0)
  } else {
    console.log(
      `❌ ${failed.length}/${results.length} FAILED: ${failed.map((f) => f.agent).join(', ')} · total ${totalElapsed.toFixed(1)}s\n`,
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
