import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getShare } from '@/lib/server/share'
import { logger } from '@/lib/server/logger'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const trace_id = nanoid(12)
  const log = logger.child({ trace_id, route: 'GET /api/result/[id]' })

  const { id } = await params
  if (!id || id.length < 4 || id.length > 64) {
    return jsonError('BAD_ID', 'id 格式不正确', 400, trace_id)
  }

  const result = await getShare(id)
  if (!result.ok) {
    if (result.code === 'NO_DB') return jsonError('NO_DB', '当前部署未启用分享链接', 503, trace_id)
    if (result.code === 'NOT_FOUND') return jsonError('NOT_FOUND', result.message, 404, trace_id)
    if (result.code === 'EXPIRED') return jsonError('EXPIRED', result.message, 410, trace_id)
    log.error({ code: result.code }, 'getShare failed')
    return jsonError('INTERNAL', result.message, 500, trace_id)
  }

  const { row } = result
  return NextResponse.json(
    {
      id: row.id,
      context: row.context,
      created_at: row.created_at,
      expires_at: row.expires_at,
      view_count: row.view_count,
    },
    {
      status: 200,
      headers: {
        'x-trace-id': trace_id,
        'cache-control': 'private, max-age=30',
      },
    },
  )
}

function jsonError(code: string, message: string, status: number, trace_id: string) {
  return NextResponse.json(
    { error: { code, message }, trace_id },
    { status, headers: { 'x-trace-id': trace_id } },
  )
}
