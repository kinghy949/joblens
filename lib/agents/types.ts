import type { z } from 'zod'
import type { ProviderName, Tier } from '@/lib/schemas'

export type AgentRunOptions = {
  provider: ProviderName
  signal?: AbortSignal
}

export type AgentStreamResult<T> = {
  /** Incremental partial objects emitted as the model streams JSON */
  partialObjectStream: AsyncIterable<Partial<T>>
  /** Final validated object */
  object: Promise<T>
  /** Token usage stats once stream completes */
  usage: Promise<{
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }>
}

export type Agent<I, O> = {
  name: string
  tier: Tier
  inputSchema: z.ZodTypeAny
  outputSchema: z.ZodTypeAny
  run(input: I, opts: AgentRunOptions): AgentStreamResult<O>
}

/**
 * Drain a stream result, returning the final validated object plus a list of
 * all partial snapshots seen. Useful for tests and the demo-mode replay.
 */
export async function collectAgentRun<T>(
  result: AgentStreamResult<T>,
): Promise<{ final: T; partials: number; usage: Awaited<AgentStreamResult<T>['usage']> }> {
  let count = 0
  for await (const _partial of result.partialObjectStream) {
    void _partial
    count++
  }
  const final = await result.object
  const usage = await result.usage
  return { final, partials: count, usage }
}
