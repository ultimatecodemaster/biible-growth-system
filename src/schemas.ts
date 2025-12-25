import { z } from 'zod'
import { containsPersonalInfo } from './utils/personal-info-sanitizer.js'

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

export const SEOMetadataSchema = z.object({
  metaTitle: z.string().max(60),
  metaDescription: z.string().max(160),
  canonicalUrl: z.string().url().refine(
    (url) => !containsPersonalInfo(url),
    { message: 'Canonical URL must not contain personal information (emails, usernames, file paths, etc.)' }
  ),
  ogTitle: z.string(),
  ogDescription: z.string(),
  ogType: z.string().default('article'),
  ogUrl: z.string().url().refine(
    (url) => !containsPersonalInfo(url),
    { message: 'OG URL must not contain personal information (emails, usernames, file paths, etc.)' }
  ),
  twitterCard: z.string().default('summary_large_image'),
  twitterTitle: z.string(),
  twitterDescription: z.string(),
  structuredData: z.object({
    faqPage: z.any(),
    article: z.any(),
    breadcrumb: z.any()
  }).refine(
    (data) => {
      const dataStr = JSON.stringify(data)
      return !containsPersonalInfo(dataStr)
    },
    { message: 'Structured data must not contain personal information (emails, usernames, file paths, etc.)' }
  ),
  author: z.string().default('Biible.net'),
  publishedDate: z.string(),
  lastUpdated: z.string(),
  tags: z.array(z.string()),
  cluster: z.string()
})

export const PublishingTargetSchema = z.object({
  id: z.string(),
  type: z.enum(['vercel', 'medium', 'devto', 'wordpress', 'social']),
  enabled: z.boolean(),
  priority: z.number(),
  config: z.record(z.any())
})

export const CEOStrategySchema = z.object({
  platforms: z.array(z.string()),
  timing: z.record(z.string()).optional(),
  adaptations: z.record(z.string()).optional(),
  reasoning: z.string(),
  priority: z.enum(['high', 'medium', 'low']).default('medium')
})

export const CEODecisionSchema = z.object({
  shouldProceed: z.boolean(),
  strategy: CEOStrategySchema.optional(),
  assignedTasks: z.array(z.object({
    agent: z.string(),
    task: z.string(),
    priority: z.enum(['high', 'medium', 'low'])
  })).optional(),
  reasoning: z.string(),
  metrics: z.record(z.any()).optional()
})

export type VerseMap = z.infer<typeof VerseMapSchema>
export type TopicRow = z.infer<typeof TopicRowSchema>
export type SafetyReview = z.infer<typeof SafetyReviewSchema>
export type SEOMetadata = z.infer<typeof SEOMetadataSchema>
export type PublishingTarget = z.infer<typeof PublishingTargetSchema>
export type CEOStrategy = z.infer<typeof CEOStrategySchema>
export type CEODecision = z.infer<typeof CEODecisionSchema>

