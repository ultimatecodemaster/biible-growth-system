import type { SEOMetadata } from '../schemas.js'

export interface PublishResult {
  success: boolean
  platform: string
  url?: string
  error?: string
  metadata?: Record<string, any>
}

export interface PublishContent {
  query: string
  slug: string
  mdxContent: string
  seoMetadata?: SEOMetadata
  verseMap?: any
}

export abstract class BasePublisher {
  public readonly targetId: string
  protected config: Record<string, any>

  constructor(targetId: string, config: Record<string, any>) {
    this.targetId = targetId
    this.config = config
  }

  abstract publish(content: PublishContent): Promise<PublishResult>

  protected log(message: string): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [Publisher:${this.targetId}] ${message}`)
  }

  protected error(message: string): void {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [Publisher:${this.targetId}] ERROR: ${message}`)
  }
}

