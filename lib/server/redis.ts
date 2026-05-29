import Redis from 'ioredis'

let _redis: Redis | null = null
let _warnedNoRedis = false

/**
 * Lazy ioredis client. Returns null when REDIS_URL is not configured so
 * callers can degrade gracefully (rate limiter falls back to in-process
 * counters; failure to throttle is preferable to a 500 storm).
 */
export function redis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  if (!url) {
    if (!_warnedNoRedis) {
      console.warn('[redis] REDIS_URL not set; rate limit will use in-memory fallback')
      _warnedNoRedis = true
    }
    return null
  }
  _redis = new Redis(url, {
    lazyConnect: false,
    enableOfflineQueue: true,
    maxRetriesPerRequest: 2,
  })
  _redis.on('error', (err) => {
    console.warn('[redis] connection error:', err.message)
  })
  return _redis
}
