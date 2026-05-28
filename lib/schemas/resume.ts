import { z } from 'zod'
import { Locale, Severity } from './common'

export const ResumeAnalystInput = z.object({
  resume_text: z.string().min(100).max(15000),
  locale: Locale.default('zh'),
})
export type ResumeAnalystInput = z.infer<typeof ResumeAnalystInput>

export const ResumeBullet = z.object({
  id: z.string(),
  company: z.string().max(60),
  role: z.string().max(60),
  text: z.string().max(280),
  has_metrics: z.boolean(),
})
export type ResumeBullet = z.infer<typeof ResumeBullet>

export const ResumeStruct = z.object({
  candidate_name: z.string().max(40).optional(),
  experience_years: z.number().min(0).max(50),
  domain_tags: z.array(z.string().max(30)).max(8),

  bullets: z.array(ResumeBullet).min(1).max(40),

  highlights: z
    .array(
      z.object({
        point: z.string().max(120),
        why_strong: z.string().max(120),
      }),
    )
    .max(6),

  weaknesses: z
    .array(
      z.object({
        point: z.string().max(120),
        severity: Severity,
      }),
    )
    .max(6),

  resume_keywords: z.array(z.string().max(30)).min(5).max(40),
})
export type ResumeStruct = z.infer<typeof ResumeStruct>
