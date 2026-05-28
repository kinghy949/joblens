import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createShare } from '@/lib/server/share'
import { logger } from '@/lib/server/logger'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const trace_id = nanoid(12)
  const log = logger.child({ trace_id, route: 'POST /api/result' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('BAD_JSON', '请求体不是合法 JSON', 400, trace_id)
  }

  if (!body || typeof body !== 'object' || !('jd_struct' in body) || !('resume_struct' in body)) {
    return jsonError('BAD_CONTEXT', '缺少 jd_struct / resume_struct 字段', 400, trace_id)
  }

  const result = await createShare(body)
  if (!result.ok) {
    if (result.code === 'NO_DB') {
      log.warn('shared link requested but DB not configured')
      return jsonError('NO_DB', '当前部署未启用分享链接，请联系管理员', 503, trace_id)
    }
    if (result.code === 'TOO_LARGE') {
      return jsonError(result.code, result.message, 413, trace_id)
    }
    log.error({ code: result.code }, 'createShare failed')
    return jsonError('INTERNAL', result.message, 500, trace_id)
  }

  log.info({ id: result.id }, 'share created')
  return NextResponse.json(
    { id: result.id, expires_at: result.expires_at },
    { status: 201, headers: { 'x-trace-id': trace_id } },
  )
}

function jsonError(code: string, message: string, status: number, trace_id: string) {
  return NextResponse.json(
    { error: { code, message }, trace_id },
    { status, headers: { 'x-trace-id': trace_id } },
  )
}
