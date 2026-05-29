import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import {
  parseResume,
  detectMimeFromFilename,
  ResumeParseError,
  type ResumeMimeType,
} from '@/lib/parse-resume'
import { logger } from '@/lib/server/logger'
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const trace_id = nanoid(12)
  const log = logger.child({ trace_id, route: '/api/upload' })

  const ip = getClientIp(req)
  const rl = await rateLimit('upload', ip, 30, 3600)
  if (!rl.allowed) {
    log.warn({ ip }, 'rate limited')
    const retry = Math.max(0, rl.reset_at - Math.floor(Date.now() / 1000))
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: `上传过于频繁，请 ${retry} 秒后再试` }, trace_id },
      { status: 429, headers: { 'x-trace-id': trace_id, ...rateLimitHeaders(rl) } },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    log.warn({ err }, 'formData parse failed')
    return jsonError('BAD_FORM_DATA', '请求体不是合法 multipart/form-data', 400, trace_id)
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return jsonError('NO_FILE', '请求里没有名为 file 的文件字段', 400, trace_id)
  }

  if (file.size === 0) {
    return jsonError('EMPTY_FILE', '文件为空', 400, trace_id)
  }
  if (file.size > MAX_BYTES) {
    return jsonError('TOO_LARGE', `文件超过 ${MAX_BYTES / 1024 / 1024}MB 上限`, 413, trace_id)
  }

  /* mime 检测：浏览器有时不给 MIME（如纯 .md），按扩展名兜底 */
  let mime: ResumeMimeType | null = null
  if (file.type === 'application/pdf') mime = 'application/pdf'
  else if (file.type === 'text/markdown') mime = 'text/markdown'
  else if (file.type === 'text/plain') mime = 'text/plain'
  else mime = detectMimeFromFilename(file.name)

  if (!mime) {
    return jsonError(
      'UNSUPPORTED_TYPE',
      `不支持的文件类型：${file.type || file.name}（仅支持 PDF / MD / TXT）`,
      415,
      trace_id,
    )
  }

  log.info(
    { name: file.name, mime, size: file.size },
    'upload received',
  )

  /* 内存解析。parseResume 返回普通文本，原 buffer 走出作用域后由 GC 回收。 */
  let text: string
  try {
    const buffer = new Uint8Array(await file.arrayBuffer())
    text = await parseResume(buffer, mime)
  } catch (err) {
    if (err instanceof ResumeParseError) {
      log.warn({ code: err.code }, err.message)
      return jsonError(err.code, err.message, 422, trace_id)
    }
    log.error({ err }, 'unexpected parse error')
    return jsonError('PARSE_FAILED', (err as Error).message, 500, trace_id)
  }

  log.info({ chars: text.length }, 'upload parsed')

  return NextResponse.json(
    {
      trace_id,
      filename: file.name,
      mime,
      size_bytes: file.size,
      chars: text.length,
      text,
    },
    { status: 200, headers: { 'x-trace-id': trace_id, ...rateLimitHeaders(rl) } },
  )
}

function jsonError(code: string, message: string, status: number, trace_id: string) {
  return NextResponse.json(
    { error: { code, message }, trace_id },
    { status, headers: { 'x-trace-id': trace_id } },
  )
}
