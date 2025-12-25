import { z } from 'zod'

export const PassageSchema = z.object({
  ref: z.string(),
  why: z.string(),
  context: z.string()
})

export const VerseMapSchema = z.object({
  query: z.string(),
  cluster: z.string(),
  risk: z.enum(['low', 'medium', 'high']),
  passages: z.array(PassageSchema),
  suggested_followups: z.array(z.string()),
  disclaimers: z.array(z.string())
})

export const TopicRowSchema = z.object({
  query: z.string(),
  cluster: z.string(),
  risk: z.enum(['low', 'medium', 'high'])
})

export const SafetyReviewSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional()
})

export type VerseMap = z.infer<typeof VerseMapSchema>
export type TopicRow = z.infer<typeof TopicRowSchema>
export type SafetyReview = z.infer<typeof SafetyReviewSchema>

