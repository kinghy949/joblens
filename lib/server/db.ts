import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

/**
 * Shared lazy Postgres client. Uses DATABASE_URL from env. Logs a single
 * warning if no env is set and returns null so callers can degrade
 * gracefully (architecture says shared-links failure must not 502 the
 * main analyze flow).
 */
export function sql(): ReturnType<typeof postgres> | null {
  if (_sql) return _sql
  const url = process.env.DATABASE_URL
  if (!url) return null
  _sql = postgres(url, {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 5,
    onnotice: () => {}, // suppress NOTICE chatter
  })
  return _sql
}
