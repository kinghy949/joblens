import { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { orchestrate, type OrchestratorEvent } from '@/lib/orchestrator'
import { pickProvider } from '@/lib/providers'
import { ProviderName } from '@/lib/schemas'
import { logger } from '@/lib/server/logger'

export const runtime = 'nodejs'
export const maxDuration = 180

const AnalyzeBody = z.object({
  jd_text: z.string().min(50).max(8000),
  resume_text: z.string().min(100).max(15000),
  provider: ProviderName.optional(),
})

const SSE_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function POST(req: NextRequest) {
  const trace_id = nanoid(12)
  const log = logger.child({ trace_id, route: '/api/analyze' })

  const isDemo = req.nextUrl.searchParams.get('demo') === '1'
  const urlProvider = req.nextUrl.searchParams.get('provider')

  let jd_text = ''
  let resume_text = ''
  let bodyProvider: 'llama' | 'claude' | undefined

  /* Demo skips body validation; real mode requires it */
  if (!isDemo) {
    try {
      const body = AnalyzeBody.parse(await req.json())
      jd_text = body.jd_text
      resume_text = body.resume_text
      bodyProvider = body.provider
    } catch (err) {
      log.warn({ err }, 'invalid body')
      return jsonError('INVALID_BODY', (err as Error).message, 400, trace_id)
    }
  }

  const provider = pickProvider(urlProvider ?? bodyProvider ?? null)
  log.info({ provider, isDemo, jd_len: jd_text.length, resume_len: resume_text.length }, 'analyze start (SSE)')

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: OrchestratorEvent) => {
        const block = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(block))
      }

      let finalSeen = false
      try {
        for await (const event of orchestrate({
          jd_text,
          resume_text,
          provider,
          is_demo: isDemo,
        })) {
          write(event)
          if (event.type === 'final') finalSeen = true
        }
      } catch (err) {
        const message = (err as Error).message
        log.error({ err: message }, 'orchestrate fatal')
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              type: 'error',
              code: 'ORCHESTRATE_FATAL',
              message,
            })}\n\n`,
          ),
        )
      } finally {
        if (!finalSeen) {
          log.warn('stream ended without final')
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { ...SSE_HEADERS, 'x-trace-id': trace_id },
  })
}

function jsonError(code: string, message: string, status: number, trace_id: string) {
  return new Response(JSON.stringify({ error: { code, message }, trace_id }), {
    status,
    headers: { 'Content-Type': 'application/json', 'x-trace-id': trace_id },
  })
}
