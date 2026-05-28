/**
 * Generate the frozen "golden" demo result by running real LLM analysis
 * against the demo fixtures, then saving the response to
 * fixtures/golden-result.json.
 *
 * Re-run this whenever the prompts / schemas change in a way that should
 * be reflected in the demo. The output is committed to the repo and used
 * by /api/analyze when ?demo=1.
 *
 * Usage: pnpm tsx scripts/freeze-golden.ts [url=http://localhost:3000]
 */
import fs from 'node:fs/promises'
import path from 'node:path'

async function main() {
  const baseUrl = process.argv[2] ?? 'http://localhost:3000'
  const [jdRaw, resumeRaw] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-jd.md'), 'utf-8'),
    fs.readFile(path.join(process.cwd(), 'fixtures/demo-resume.md'), 'utf-8'),
  ])
  const jd_text = jdRaw.replace(/^> .*$/gm, '').trim()
  const resume_text = resumeRaw.replace(/^> .*$/gm, '').trim()

  console.log(`[freeze-golden] hitting ${baseUrl}/api/analyze ...`)
  const res = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jd_text, resume_text }),
  })
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text())
    process.exit(1)
  }
  const data = await res.json()
  if (!data.jd_struct || !data.resume_struct) {
    console.error('missing struct(s) in response, aborting freeze')
    process.exit(1)
  }

  const golden = {
    frozen_at: new Date().toISOString(),
    source: 'fixtures/demo-jd.md + fixtures/demo-resume.md',
    provider: data.provider,
    jd_struct: data.jd_struct,
    resume_struct: data.resume_struct,
    // Phases 2/3 (scorers / rewriter / interviewer) will be filled in once
    // those Agents land. For now Week-1 only freezes phase 1 output and the
    // analysis-loading screen shows mock content for the later phases.
  }

  const out = path.join(process.cwd(), 'fixtures/golden-result.json')
  await fs.writeFile(out, JSON.stringify(golden, null, 2), 'utf-8')
  console.log(`✅ wrote ${out}`)
  console.log(`   jd hard_skills: ${golden.jd_struct.hard_skills.length}`)
  console.log(`   resume bullets: ${golden.resume_struct.bullets.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
