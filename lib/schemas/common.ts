import { z } from 'zod'

export const Locale = z.enum(['zh', 'en'])
export type Locale = z.infer<typeof Locale>

export const Tier = z.enum(['light', 'heavy'])
export type Tier = z.infer<typeof Tier>

export const ProviderName = z.enum(['llama', 'claude'])
export type ProviderName = z.infer<typeof ProviderName>

export const Severity = z.enum(['low', 'medium', 'high'])
export type Severity = z.infer<typeof Severity>

export const Impact = z.enum(['minor', 'moderate', 'major'])
export type Impact = z.infer<typeof Impact>

export const SkillLevel = z.enum(['required', 'preferred', 'bonus'])
export type SkillLevel = z.infer<typeof SkillLevel>

export const Grade = z.enum(['S', 'A', 'B', 'C', 'D'])
export type Grade = z.infer<typeof Grade>

export const AgentStatus = z.enum(['pending', 'running', 'done', 'error'])
export type AgentStatus = z.infer<typeof AgentStatus>

export const SCHEMA_VERSION = '1.0.0' as const

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}
