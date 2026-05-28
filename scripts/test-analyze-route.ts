/**
 * End-to-end test for POST /api/analyze.
 * Loads fixtures, posts to the dev server, validates the response shape.
 *
 * Usage: pnpm tsx scripts/test-analyze-route.ts [url=http://localhost:3000]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { JDStruct, ResumeStruct } from '../lib/schemas'

const ResponseSchema = z.object({
  trace_id: z.string(),
  provider: z.enum(['llama', 'claude']),
  schema_version: z.string(),
  total_ms: z.number(),
  phase1_ms: z.number(),
  agents: z.object({
    'jd-parser': z.object({
      status: z.enum(['done', 'error']),
      duration_ms: z.number(),
      tokens_in: z.number().nullable().optional(),
      tokens_out: z.number().nullable().optional(),
      error: z.string().optional(),
    }),
    'resume-analyst': z.object({
      status: z.enum(['done', 'error']),
      duration_ms: z.number(),
      tokens_in: z.number().nullable().optional(),
      tokens_out: z.number().nullable().optional(),
      error: z.string().optional(),
    }),
  }),
  jd_struct: JDStruct.nullable(),
  resume_struct: ResumeStruct.nullable(),
})

async function main() {
  const baseUrl = process.argv[2] ?? 'http://localhost:3000'

  const [jdRaw, resumeRaw] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-jd.md'), 'utf-8'),
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-resume.md'), 'utf-8'),
  ])
  const jd_text = jdRaw.replace(/^> .*$/gm, '').trim()
  const resume_text = resumeRaw.replace(/^> .*$/gm, '').trim()

  console.log(
    `\n[test-analyze-route] POST ${baseUrl}/api/analyze\n  jd: ${jd_text.length} chars, resume: ${resume_text.length} chars\n`,
  )

  const t0 = Date.now()
  const res = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jd_text, resume_text }),
  })
  const ms = Date.now() - t0
  const trace_id = res.headers.get('x-trace-id')

  console.log(`  HTTP ${res.status} · ${ms}ms · trace_id=${trace_id}`)

  if (!res.ok) {
    const body = await res.text()
    console.error('  body:', body.slice(0, 400))
    process.exit(1)
  }

  const data = ResponseSchema.parse(await res.json())

  console.log(`\n=== summary ===`)
  console.log(`  provider:  ${data.provider}`)
  console.log(
    `  jd-parser: ${data.agents['jd-parser'].status} · ${data.agents['jd-parser'].duration_ms}ms` +
      (data.agents['jd-parser'].tokens_out
        ? ` · ${data.agents['jd-parser'].tokens_in}+${data.agents['jd-parser'].tokens_out} tokens`
        : ''),
  )
  console.log(
    `  resume-analyst: ${data.agents['resume-analyst'].status} · ${data.agents['resume-analyst'].duration_ms}ms` +
      (data.agents['resume-analyst'].tokens_out
        ? ` · ${data.agents['resume-analyst'].tokens_in}+${data.agents['resume-analyst'].tokens_out} tokens`
        : ''),
  )
  console.log(`  phase1:    ${data.phase1_ms}ms (parallel)`)
  console.log(`  total:     ${data.total_ms}ms`)

  if (data.jd_struct) {
    console.log(`\n  jd_struct.role_title: ${data.jd_struct.role_title}`)
    console.log(`  jd_struct.hard_skills: ${data.jd_struct.hard_skills.length}`)
    console.log(`  jd_struct.keywords: ${data.jd_struct.keywords.length}`)
  }
  if (data.resume_struct) {
    console.log(`\n  resume_struct.bullets: ${data.resume_struct.bullets.length}`)
    console.log(`  resume_struct.highlights: ${data.resume_struct.highlights.length}`)
    console.log(`  resume_struct.weaknesses: ${data.resume_struct.weaknesses.length}`)
  }

  const allOk =
    data.jd_struct &&
    data.resume_struct &&
    data.agents['jd-parser'].status === 'done' &&
    data.agents['resume-analyst'].status === 'done'

  console.log(`\n${allOk ? '✅' : '❌'} end-to-end check`)
  process.exit(allOk ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
