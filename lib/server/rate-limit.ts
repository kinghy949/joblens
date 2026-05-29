import { NextRequest } from 'next/server'
import { redis } from './redis'

export type RateLimitResult = {
  allowed: boolean
  /** Calls remaining in the current window (>= 0 even when denied). */
  remaining: number
  /** Unix-seconds when the current window ends. */
  reset_at: number
  /** Configured cap. */
  limit: number
}

/**
 * Fixed-window throttle keyed on (route, identity, window). Uses Redis when
 * available; falls back to in-process Map so dev (no Redis) still works.
 *
 * Returns allowed=true on Redis errors so a backend hiccup doesn't take the
 * whole site down — failing open matches the architecture's "Redis
 * unavailable must not stop the main flow" contract.
 */
export async function rateLimit(
  routeKey: string,
  identity: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const window = Math.floor(now / windowSec)
  const reset_at = (window + 1) * windowSec
  const key = `rl:${routeKey}:${identity}:${window}`

  const client = redis()
  if (client) {
    try {
      const pipeline = client.multi()
      pipeline.incr(key)
      pipeline.expire(key, windowSec + 5) // small buffer to outlive the window
      const res = await pipeline.exec()
      const count = Number(res?.[0]?.[1] ?? 0)
      const remaining = Math.max(0, limit - count)
      return { allowed: count <= limit, remaining, reset_at, limit }
    } catch (err) {
      console.warn('[rate-limit] redis error, allowing request:', (err as Error).message)
      return { allowed: true, remaining: limit, reset_at, limit }
    }
  }

  /* in-process fallback */
  return memoryCounter(key, limit, reset_at, windowSec)
}

/* ---------- in-memory fallback ---------- */

const memory = new Map<string, { count: number; expires_at: number }>()
let memoryGcLast = 0

function memoryCounter(
  key: string,
  limit: number,
  reset_at: number,
  windowSec: number,
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000)

  /* lightweight GC every 60s so abandoned IPs don't linger */
  if (now - memoryGcLast > 60) {
    for (const [k, v] of memory) if (v.expires_at <= now) memory.delete(k)
    memoryGcLast = now
  }

  const existing = memory.get(key)
  const next = existing && existing.expires_at > now
    ? { count: existing.count + 1, expires_at: existing.expires_at }
    : { count: 1, expires_at: now + windowSec + 5 }
  memory.set(key, next)

  const remaining = Math.max(0, limit - next.count)
  return { allowed: next.count <= limit, remaining, reset_at, limit }
}

/* ---------- helpers for routes ---------- */

/** Extract a best-effort client IP. Prefers Cloudflare's CF-Connecting-IP
 *  (DNS-only mode still sets it), then X-Forwarded-For, then X-Real-IP. */
export function getClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri
  return 'unknown'
}

/** Build the standard rate-limit response headers. */
export function rateLimitHeaders(rl: RateLimitResult): HeadersInit {
  const retryAfter = Math.max(0, rl.reset_at - Math.floor(Date.now() / 1000))
  return {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.reset_at),
    ...(rl.allowed ? {} : { 'Retry-After': String(retryAfter) }),
  }
}
