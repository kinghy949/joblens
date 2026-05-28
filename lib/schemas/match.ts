import { z } from 'zod'
import { Grade } from './common'
import { JDStruct } from './jd'
import { ResumeStruct } from './resume'

export const MatchScorerInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
})
export type MatchScorerInput = z.infer<typeof MatchScorerInput>

export const KeywordCoverage = z.object({
  keyword: z.string().max(30),
  hit: z.enum(['strong', 'weak', 'missing']),
  evidence: z.string().max(80),
})
export type KeywordCoverage = z.infer<typeof KeywordCoverage>

export const MatchScores = z.object({
  overall_score: z.number().min(0).max(100),
  grade: Grade,

  dim_scores: z.object({
    tech: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    project: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    uniqueness: z.number().min(0).max(100),
  }),

  summary: z.string().max(60),

  keyword_coverage: z.array(KeywordCoverage).max(25),
})
export type MatchScores = z.infer<typeof MatchScores>
