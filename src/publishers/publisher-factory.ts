import { readFileSync } from 'fs'
import { join } from 'path'
import { BasePublisher, type PublishResult } from './base-publisher.js'
import { VercelPublisher } from './vercel-publisher.js'
import { MediumPublisher } from './medium-publisher.js'
import { DevToPublisher } from './devto-publisher.js'
import { WordPressPublisher } from './wordpress-publisher.js'
import { SocialPublisher } from './social-publisher.js'

export interface PublishingTarget {
  id: string
  type: 'vercel' | 'medium' | 'devto' | 'wordpress' | 'social'
  enabled: boolean
  priority: number
  config: Record<string, any>
}

let targetsConfig: { targets: PublishingTarget[] } | null = null

function loadTargetsConfig(): { targets: PublishingTarget[] } {
  if (targetsConfig) return targetsConfig

  const configPath = join(process.cwd(), 'config', 'publishing-targets.json')
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    // Replace environment variables in config
    let processedContent = configContent
    for (const [key, value] of Object.entries(process.env)) {
      processedContent = processedContent.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value || '')
    }
    targetsConfig = JSON.parse(processedContent) as { targets: PublishingTarget[] }
    return targetsConfig
  } catch (error) {
    console.error(`[PublisherFactory] Failed to load publishing targets config: ${error}`)
    return { targets: [] }
  }
}

export function getEnabledPublishers(): BasePublisher[] {
  const config = loadTargetsConfig()
  const publishers: BasePublisher[] = []

  for (const target of config.targets) {
    if (!target.enabled) continue

    let publisher: BasePublisher | null = null

    switch (target.type) {
      case 'vercel':
        publisher = new VercelPublisher(target.id, target.config)
        break
      case 'medium':
        publisher = new MediumPublisher(target.id, target.config)
        break
      case 'devto':
        publisher = new DevToPublisher(target.id, target.config)
        break
      case 'wordpress':
        publisher = new WordPressPublisher(target.id, target.config)
        break
      case 'social':
        publisher = new SocialPublisher(target.id, target.config)
        break
      default:
        console.warn(`[PublisherFactory] Unknown publisher type: ${target.type} for ${target.id}`)
        continue
    }

    if (publisher) {
      publishers.push(publisher)
    }
  }

  // Sort by priority (lower number = higher priority)
  return publishers.sort((a, b) => {
    const aTarget = config.targets.find(t => t.id === a.targetId)
    const bTarget = config.targets.find(t => t.id === b.targetId)
    return (aTarget?.priority || 999) - (bTarget?.priority || 999)
  })
}

export async function publishToAllTargets(
  content: Parameters<BasePublisher['publish']>[0]
): Promise<PublishResult[]> {
  const publishers = getEnabledPublishers()
  const results: PublishResult[] = []

  if (publishers.length === 0) {
    console.warn('[PublisherFactory] No enabled publishers found')
    return results
  }

  console.log(`[PublisherFactory] Publishing to ${publishers.length} target(s)`)

  // Publish to all enabled targets in parallel
  const publishPromises = publishers.map(publisher => 
    publisher.publish(content).catch(error => ({
      success: false,
      platform: (publisher as any).targetId || 'unknown',
      error: error instanceof Error ? error.message : String(error)
    }))
  )

  const publishResults = await Promise.all(publishPromises)
  results.push(...publishResults)

  const successCount = publishResults.filter(r => r.success).length
  const failCount = publishResults.filter(r => !r.success).length

  console.log(`[PublisherFactory] Publishing complete: ${successCount} succeeded, ${failCount} failed`)

  return results
}

