/**
 * Smoke test for the Provider abstraction.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-provider.ts            # both providers (skips claude if no key)
 *   pnpm tsx scripts/smoke-provider.ts llama
 *   pnpm tsx scripts/smoke-provider.ts claude
 */
import 'dotenv/config'
import { generateText } from 'ai'
import { resolveModel } from '../lib/providers'
import type { ProviderName } from '../lib/schemas'

const PROMPT =
  '请用中文一句话回答：JobLens 是什么？回答控制在 30 字以内。'

async function ping(provider: ProviderName) {
  console.log(`\n[smoke] ${provider} · light tier`)
  try {
    const model = resolveModel(provider, 'light')
    const t0 = Date.now()
    const { text, usage } = await generateText({
      model,
      prompt: PROMPT,
      maxTokens: 100,
    })
    const ms = Date.now() - t0
    console.log(`  ✓ ${ms}ms · ${usage?.totalTokens ?? '?'} tokens`)
    console.log(`  response: ${text.trim()}`)
  } catch (err) {
    console.error(`  ✗ FAILED:`, (err as Error).message)
    process.exitCode = 1
  }
}

async function main() {
  const which = process.argv[2] as ProviderName | undefined
  const targets: ProviderName[] = which
    ? [which]
    : process.env.ANTHROPIC_API_KEY
      ? ['llama', 'claude']
      : ['llama']

  for (const p of targets) await ping(p)
  console.log('\n[smoke] done.')
}

main()
