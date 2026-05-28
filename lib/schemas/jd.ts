import { z } from 'zod'
import { Locale, SkillLevel } from './common'

export const JDParserInput = z.object({
  jd_text: z.string().min(50).max(8000),
  locale: Locale.default('zh'),
})
export type JDParserInput = z.infer<typeof JDParserInput>

export const JDStruct = z.object({
  role_title: z.string().max(80),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'staff', 'lead']),

  hard_skills: z
    .array(
      z.object({
        name: z.string().max(40),
        level: SkillLevel,
      }),
    )
    .max(20),

  soft_skills: z.array(z.string().max(40)).max(10),

  hidden_requirements: z
    .array(
      z.object({
        requirement: z.string().max(120),
        evidence: z.string().max(120),
      }),
    )
    .max(8),

  keywords: z.array(z.string().max(30)).min(5).max(25),

  one_liner: z.string().max(80),
})
export type JDStruct = z.infer<typeof JDStruct>
