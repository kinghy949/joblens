import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV1 } from 'ai'
import type { ProviderName, Tier } from '@/lib/schemas'

/** Per-tier model id for each provider */
const MODELS = {
  llama: {
    light: 'meta/llama-3.3-70b-instruct',
    heavy: 'meta/llama-3.3-70b-instruct',
  },
  claude: {
    light: 'claude-haiku-4-5',
    heavy: 'claude-sonnet-4-6',
  },
} as const

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1'

let llamaProvider: ReturnType<typeof createOpenAICompatible> | null = null
let claudeProvider: ReturnType<typeof createAnthropic> | null = null

function getLlama() {
  if (!llamaProvider) {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      throw new Error(
        'NVIDIA_API_KEY is not set. Get one at https://build.nvidia.com and add it to .env',
      )
    }
    llamaProvider = createOpenAICompatible({
      name: 'nvidia-nim',
      baseURL: NIM_BASE_URL,
      apiKey,
    })
  }
  return llamaProvider
}

function getClaude() {
  if (!claudeProvider) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Required when provider=claude.',
      )
    }
    claudeProvider = createAnthropic({ apiKey })
  }
  return claudeProvider
}

/**
 * Resolve a model for the given (provider, tier).
 * Llama mode uses the same model for both tiers (NIM free-tier optimization);
 * Claude mode uses Haiku for light tasks and Sonnet for heavy tasks.
 */
export function resolveModel(
  provider: ProviderName,
  tier: Tier,
): LanguageModelV1 {
  const modelId = MODELS[provider][tier]
  if (provider === 'llama') {
    return getLlama()(modelId)
  }
  return getClaude()(modelId)
}

/**
 * Returns the default provider for a request. URL query (?provider=claude)
 * overrides the PROVIDER env var; otherwise PROVIDER env var; otherwise 'llama'.
 */
export function pickProvider(urlOverride?: string | null): ProviderName {
  const fromUrl = urlOverride === 'claude' || urlOverride === 'llama' ? urlOverride : null
  if (fromUrl) return fromUrl
  const fromEnv = process.env.PROVIDER
  return fromEnv === 'claude' ? 'claude' : 'llama'
}

export { MODELS, NIM_BASE_URL }
