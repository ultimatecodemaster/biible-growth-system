import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { CEODecisionSchema, type CEODecision, type CEOStrategy } from '../schemas.js'
import { z } from 'zod'

export interface CEOContext {
  systemHealth?: {
    status: string
    agentStatuses: Record<string, any>
  }
  recentContent?: Array<{
    query: string
    slug: string
    platforms: string[]
    publishedAt: string
  }>
  metrics?: {
    totalContent: number
    averageEngagement?: number
    topPerformingPlatforms?: string[]
  }
  currentTopic?: {
    query: string
    cluster: string
    risk: string
  }
}

export async function runCEOCoordinator(context: CEOContext): Promise<CEODecision> {
  console.log('[CEO Coordinator] Starting strategic analysis...')

  const systemPrompt = loadPrompt('ceo_coordinator')
  
  // Build context summary for CEO
  const contextSummary = buildContextSummary(context)
  
  const prompt = formatPrompt(systemPrompt, {
    context: contextSummary,
    currentTopic: context.currentTopic ? JSON.stringify(context.currentTopic, null, 2) : 'No current topic',
    timestamp: new Date().toISOString()
  })

  try {
    const response = await callLLM('ceo_coordinator', prompt, systemPrompt)
    
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[CEO Coordinator] No JSON found in response, using default decision')
      return getDefaultDecision(context)
    }

    const parsed = JSON.parse(jsonMatch[0])
    const decision = CEODecisionSchema.parse(parsed)
    
    console.log(`[CEO Coordinator] Decision: ${decision.shouldProceed ? 'PROCEED' : 'HOLD'}`)
    if (decision.strategy) {
      console.log(`[CEO Coordinator] Strategy: ${decision.strategy.reasoning}`)
      console.log(`[CEO Coordinator] Platforms: ${decision.strategy.platforms.join(', ')}`)
    }
    
    return decision
  } catch (error) {
    console.error('[CEO Coordinator] Error in decision making:', error)
    // Return safe default decision
    return getDefaultDecision(context)
  }
}

function buildContextSummary(context: CEOContext): string {
  const parts: string[] = []

  if (context.systemHealth) {
    parts.push(`System Health: ${context.systemHealth.status}`)
    if (Object.keys(context.systemHealth.agentStatuses).length > 0) {
      parts.push(`Agent Statuses: ${JSON.stringify(context.systemHealth.agentStatuses)}`)
    }
  }

  if (context.metrics) {
    parts.push(`Total Content Published: ${context.metrics.totalContent}`)
    if (context.metrics.topPerformingPlatforms) {
      parts.push(`Top Platforms: ${context.metrics.topPerformingPlatforms.join(', ')}`)
    }
  }

  if (context.recentContent && context.recentContent.length > 0) {
    parts.push(`Recent Content: ${context.recentContent.length} items in last batch`)
  }

  return parts.length > 0 ? parts.join('\n') : 'No additional context available'
}

function getDefaultDecision(context: CEOContext): CEODecision {
  // Default: proceed with all enabled platforms
  const defaultStrategy: CEOStrategy = {
    platforms: ['biible-main'], // Default to main site
    reasoning: 'Default strategy: proceed with standard publishing pipeline',
    priority: 'medium'
  }

  return {
    shouldProceed: true,
    strategy: defaultStrategy,
    reasoning: 'Using default decision due to CEO coordinator error. Proceeding with standard pipeline.',
    assignedTasks: []
  }
}

export async function getPublishingStrategy(
  topic: { query: string; cluster: string; risk: string },
  availablePlatforms: string[]
): Promise<CEOStrategy> {
  console.log('[CEO Coordinator] Determining publishing strategy...')

  const systemPrompt = loadPrompt('ceo_coordinator')
  
  const prompt = `Analyze this content topic and determine the best publishing strategy.

Topic: ${topic.query}
Cluster: ${topic.cluster}
Risk Level: ${topic.risk}
Available Platforms: ${availablePlatforms.join(', ')}

Provide a strategic decision in JSON format with:
- platforms: array of platform IDs to publish to
- reasoning: why these platforms were chosen
- priority: high/medium/low
- adaptations: optional object with platform-specific adaptation notes

Focus on maximizing reach and engagement while maintaining quality.`

  try {
    const response = await callLLM('ceo_coordinator', prompt, systemPrompt)
    
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[CEO Coordinator] No JSON in strategy response, using default')
      return {
        platforms: availablePlatforms.slice(0, 1), // Default to first available
        reasoning: 'Default strategy: using first available platform',
        priority: 'medium'
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    // Check if parsed is already a strategy or wrapped in a decision
    let strategy: CEOStrategy
    if (parsed.platforms && parsed.reasoning) {
      // It's already a strategy object
      strategy = {
        platforms: parsed.platforms || [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        priority: parsed.priority || 'medium',
        timing: parsed.timing,
        adaptations: parsed.adaptations
      }
    } else if (parsed.strategy) {
      // It's wrapped in a decision object
      strategy = {
        platforms: parsed.strategy.platforms || [],
        reasoning: parsed.strategy.reasoning || 'No reasoning provided',
        priority: parsed.strategy.priority || 'medium',
        timing: parsed.strategy.timing,
        adaptations: parsed.strategy.adaptations
      }
    } else {
      // Default fallback
      strategy = {
        platforms: [],
        reasoning: 'Could not parse strategy from response',
        priority: 'medium'
      }
    }
    
    console.log(`[CEO Coordinator] Strategy determined: ${strategy.platforms.length} platform(s)`)
    return strategy
  } catch (error) {
    console.error('[CEO Coordinator] Error determining strategy:', error)
    return {
      platforms: availablePlatforms.slice(0, 1),
      reasoning: 'Default strategy due to error',
      priority: 'medium'
    }
  }
}

