import { z } from 'zod'
import { JDStruct } from './jd'
import { ResumeStruct } from './resume'
import { MatchScores } from './match'

export const InterviewerInput = z.object({
  jd: JDStruct,
  resume: ResumeStruct,
  scores: MatchScores,
})
export type InterviewerInput = z.infer<typeof InterviewerInput>

export const InterviewQuestion = z.object({
  question: z.string().max(160),
  probe_point: z.string().max(100),
  category: z.enum([
    'technical_depth',
    'gap_probe',
    'soft_skill',
    'project_detail',
    'scenario',
  ]),
  suggested_angle: z.string().max(200),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})
export type InterviewQuestion = z.infer<typeof InterviewQuestion>

export const InterviewerOutput = z.object({
  questions: z.array(InterviewQuestion).min(3).max(5),
})
export type InterviewerOutput = z.infer<typeof InterviewerOutput>
