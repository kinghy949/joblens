import { z } from 'zod'
import { Impact } from './common'
import { JDStruct } from './jd'
import { ResumeStruct, ResumeBullet } from './resume'
import { MatchScores } from './match'

export const RewriterInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
  target_bullet_ids: z.array(z.string()).max(10),
})
export type RewriterInput = z.infer<typeof RewriterInput>

export const Rewrite = z.object({
  bullet_id: z.string(),
  original: z.string().max(280),
  rewritten: z.string().max(280),
  reason: z.string().max(180),
  impact: Impact,
  hit_keywords: z.array(z.string().max(30)).max(5),
})
export type Rewrite = z.infer<typeof Rewrite>

export const RewriterOutput = z.object({
  rewrites: z.array(Rewrite).max(10),
})
export type RewriterOutput = z.infer<typeof RewriterOutput>

/**
 * 编排器预筛：从全部 bullets 中选出最值得改写的 top N（默认 8）。
 * 评分规则（详见 docs/schemas.md 第五节）：
 * - 缺指标 +3
 * - 命中弱关键词 +2
 * - 应植入但未出现的 JD 必备词 +1
 * - 含弱动词（参与/协助/帮助/负责）+1
 */
export function selectRewriteTargets(
  bullets: ResumeBullet[],
  jd: JDStruct,
  scores: MatchScores,
  limit = 8,
): string[] {
  const jdRequiredKeywords = new Set(
    jd.hard_skills
      .filter((s) => s.level === 'required')
      .map((s) => s.name.toLowerCase()),
  )
  const missingOrWeak = new Set(
    scores.keyword_coverage
      .filter((k) => k.hit !== 'strong')
      .map((k) => k.keyword.toLowerCase()),
  )

  const scored = bullets.map((b) => {
    let score = 0
    if (!b.has_metrics) score += 3
    const text = b.text.toLowerCase()
    for (const kw of missingOrWeak) if (text.includes(kw)) score += 2
    for (const kw of jdRequiredKeywords) if (!text.includes(kw)) score += 1
    if (/(参与|协助|帮助|负责)/.test(b.text)) score += 1
    return { id: b.id, score }
  })

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.id)
}
