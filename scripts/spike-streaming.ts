/**
 * R1 Spike: Verify streaming behavior of NIM-Llama (and Claude if key available).
 *
 * Decision question: does `streamObject` actually stream partial JSON, or does
 * the model only emit a final blob? If the latter, the "4 panels typing" demo
 * effect requires the dual-channel (narration + JSON) workaround.
 *
 * Usage: pnpm tsx scripts/spike-streaming.ts [llama|claude]
 */
import 'dotenv/config'
import { streamText, streamObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '../lib/providers'
import type { ProviderName } from '../lib/schemas'

const JD_SAMPLE = `我们正在招聘高级后端工程师 · LLM 应用方向。
任职要求：
- 3 年以上 Python（FastAPI / Django）经验
- 熟悉分布式系统、Kafka/RabbitMQ、Kubernetes
- 熟悉 Postgres / MySQL
- 有 RAG / Agent / Function Calling 工程化经验
- 加分：开源贡献、向量数据库（Qdrant / Milvus）`

const JDSchema = z.object({
  role_title: z.string().max(80),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'staff', 'lead']),
  hard_skills: z
    .array(z.object({ name: z.string(), level: z.enum(['required', 'preferred', 'bonus']) }))
    .max(20),
  keywords: z.array(z.string()).min(5).max(20),
  one_liner: z.string().max(80),
})

type Probe = {
  mode: string
  firstChunkMs?: number
  totalMs: number
  chunkCount: number
  bytesReceived: number
  ok: boolean
  sample?: string
  error?: string
}

async function probeStreamText(provider: ProviderName): Promise<Probe> {
  const t0 = Date.now()
  let firstChunkMs: number | undefined
  let chunkCount = 0
  let bytes = 0
  let buf = ''
  try {
    const result = streamText({
      model: resolveModel(provider, 'light'),
      prompt: `用 50-80 字描述以下 JD 的岗位定位，纯文本一段话：\n\n${JD_SAMPLE}`,
      maxTokens: 200,
    })
    for await (const delta of result.textStream) {
      if (firstChunkMs === undefined) firstChunkMs = Date.now() - t0
      chunkCount++
      bytes += delta.length
      buf += delta
    }
    return {
      mode: 'streamText',
      firstChunkMs,
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: true,
      sample: buf.slice(0, 80),
    }
  } catch (err) {
    return {
      mode: 'streamText',
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: false,
      error: (err as Error).message,
    }
  }
}

async function probeStreamObject(provider: ProviderName): Promise<Probe> {
  const t0 = Date.now()
  let firstChunkMs: number | undefined
  let chunkCount = 0
  let bytes = 0
  let last: unknown
  try {
    const result = streamObject({
      model: resolveModel(provider, 'light'),
      schema: JDSchema,
      prompt: `把下面的 JD 解析为结构化 JSON：\n\n${JD_SAMPLE}`,
      maxTokens: 600,
    })
    for await (const partial of result.partialObjectStream) {
      if (firstChunkMs === undefined) firstChunkMs = Date.now() - t0
      chunkCount++
      const s = JSON.stringify(partial)
      bytes = s.length
      last = partial
    }
    return {
      mode: 'streamObject',
      firstChunkMs,
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: true,
      sample: JSON.stringify(last).slice(0, 100),
    }
  } catch (err) {
    return {
      mode: 'streamObject',
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: false,
      error: (err as Error).message,
    }
  }
}

async function probeDualChannel(provider: ProviderName): Promise<Probe> {
  const t0 = Date.now()
  let firstChunkMs: number | undefined
  let chunkCount = 0
  let bytes = 0
  let buf = ''
  try {
    const result = streamText({
      model: resolveModel(provider, 'light'),
      prompt: `请按以下严格格式分两段输出。第一段是给用户看的人话描述（流式输出最佳），第二段是 JSON 结果。

---FORMAT---
<narration>
（这里用 60-100 字的中文，分析这份 JD 的核心定位、识别到的关键技能、隐藏要求。一句一句往外输出。）
</narration>
<json>
{
  "role_title": "...",
  "seniority": "...",
  "hard_skills": [{"name": "...", "level": "required"}],
  "keywords": ["..."],
  "one_liner": "..."
}
</json>
---END---

JD:
${JD_SAMPLE}`,
      maxTokens: 800,
    })
    for await (const delta of result.textStream) {
      if (firstChunkMs === undefined) firstChunkMs = Date.now() - t0
      chunkCount++
      bytes += delta.length
      buf += delta
    }
    const narration = buf.match(/<narration>([\s\S]*?)<\/narration>/)?.[1]?.trim() ?? '(missing)'
    const json = buf.match(/<json>([\s\S]*?)<\/json>/)?.[1]?.trim() ?? '(missing)'
    let jsonOk = false
    try {
      JDSchema.partial().parse(JSON.parse(json))
      jsonOk = true
    } catch {}
    return {
      mode: `dualChannel · narration=${narration.slice(0, 30)}... · jsonOk=${jsonOk}`,
      firstChunkMs,
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: true,
      sample: narration.slice(0, 80),
    }
  } catch (err) {
    return {
      mode: 'dualChannel',
      totalMs: Date.now() - t0,
      chunkCount,
      bytesReceived: bytes,
      ok: false,
      error: (err as Error).message,
    }
  }
}

function printProbe(p: Probe) {
  if (!p.ok) {
    console.log(`  ✗ ${p.mode} FAILED after ${p.totalMs}ms: ${p.error}`)
    return
  }
  const incremental = p.chunkCount > 3 ? '✓ 增量流式' : '✗ 单次返回'
  console.log(
    `  ${p.mode.padEnd(35)} firstChunk=${p.firstChunkMs}ms total=${p.totalMs}ms chunks=${p.chunkCount} bytes=${p.bytesReceived} ${incremental}`,
  )
  if (p.sample) console.log(`    sample: ${p.sample.replace(/\n/g, ' ')}`)
}

async function main() {
  const which = (process.argv[2] as ProviderName | undefined) ?? 'llama'
  console.log(`\n[spike-streaming] provider=${which}\n`)

  console.log('1. streamText (pure text streaming):')
  printProbe(await probeStreamText(which))

  console.log('\n2. streamObject (structured JSON streaming):')
  printProbe(await probeStreamObject(which))

  console.log('\n3. dualChannel (narration + JSON in one prompt):')
  printProbe(await probeDualChannel(which))

  console.log('\n[spike-streaming] done.\n')
  console.log(
    'Decision rubric:\n' +
      '  - If streamObject incremental → use it directly, skip dual-channel.\n' +
      '  - If streamObject single-blob but streamText incremental → adopt dual-channel.\n' +
      '  - If neither incremental → fall back to "pretend streaming" client-side animation.',
  )
}

main()
