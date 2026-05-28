import { customAlphabet } from 'nanoid'
import { sql } from './db'
import { logger } from './logger'

/** URL-friendly, no ambiguous chars (no I/l/0/O). 12 chars ≈ 56 bits, well
 *  above the bar for "unguessable without auth". */
const shortId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 12)

const MAX_CONTEXT_BYTES = 256 * 1024 // 256KB, way over a typical analysis

export type SharedRow = {
  id: string
  context: unknown
  created_at: string
  expires_at: string
  view_count: number
}

export type CreateShareResult =
  | { ok: true; id: string; expires_at: string }
  | { ok: false; code: 'NO_DB' | 'TOO_LARGE' | 'INTERNAL'; message: string }

export async function createShare(context: unknown): Promise<CreateShareResult> {
  const s = sql()
  if (!s) return { ok: false, code: 'NO_DB', message: 'shared links disabled (no DB)' }

  const json = JSON.stringify(context)
  if (json.length > MAX_CONTEXT_BYTES) {
    return { ok: false, code: 'TOO_LARGE', message: `分析上下文过大 (${json.length}B > ${MAX_CONTEXT_BYTES}B)` }
  }

  const id = shortId()
  try {
    const rows = await s<
      { expires_at: Date }[]
    >`insert into shared_results (id, context) values (${id}, ${s.json(JSON.parse(json))}::jsonb) returning expires_at`
    return { ok: true, id, expires_at: rows[0].expires_at.toISOString() }
  } catch (err) {
    logger.error({ err }, 'createShare failed')
    return { ok: false, code: 'INTERNAL', message: (err as Error).message }
  }
}

export type GetShareResult =
  | { ok: true; row: SharedRow }
  | { ok: false; code: 'NO_DB' | 'NOT_FOUND' | 'EXPIRED' | 'INTERNAL'; message: string }

export async function getShare(id: string): Promise<GetShareResult> {
  const s = sql()
  if (!s) return { ok: false, code: 'NO_DB', message: 'shared links disabled (no DB)' }

  try {
    const rows = await s<SharedRow[]>`
      select id, context, created_at, expires_at, view_count
      from shared_results where id = ${id}
    `
    if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: '分享链接不存在' }

    const row = rows[0]
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      // eagerly delete so subsequent visits get NOT_FOUND, not a stale row
      await s`delete from shared_results where id = ${id}`
      return { ok: false, code: 'EXPIRED', message: '分享链接已过期' }
    }

    /* fire-and-forget view counter; ignore errors so a stat write can't
     * block the response */
    s`update shared_results set view_count = view_count + 1 where id = ${id}`.catch(
      (err) => logger.warn({ err }, 'view_count update failed'),
    )

    return { ok: true, row }
  } catch (err) {
    logger.error({ err, id }, 'getShare failed')
    return { ok: false, code: 'INTERNAL', message: (err as Error).message }
  }
}

/** Opportunistic cleanup. The deployment compose runs a cron container
 *  every hour; this is the same SQL, invokable from any process. */
export async function purgeExpired(): Promise<number> {
  const s = sql()
  if (!s) return 0
  try {
    const result = await s`delete from shared_results where expires_at < now()`
    return result.count ?? 0
  } catch (err) {
    logger.error({ err }, 'purgeExpired failed')
    return 0
  }
}
