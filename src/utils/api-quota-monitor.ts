import OpenAI from 'openai'
import { logInfo, logWarn, logError } from './logger.js'

interface QuotaInfo {
  hasQuota: boolean
  remainingCredits?: number
  usage?: {
    totalUsage: number
    dailyUsage?: number
  }
  error?: string
}

let openaiClient: OpenAI | null = null
let lastQuotaCheck: Date | null = null
let cachedQuotaInfo: QuotaInfo | null = null
const QUOTA_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Initialize OpenAI client for quota checking
 */
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  
  return openaiClient
}

/**
 * Check OpenAI API quota and usage
 * Note: OpenAI doesn't provide a direct quota API, so we use a test call
 */
export async function checkAPIQuota(): Promise<QuotaInfo> {
  // Return cached result if recent
  if (cachedQuotaInfo && lastQuotaCheck) {
    const cacheAge = Date.now() - lastQuotaCheck.getTime()
    if (cacheAge < QUOTA_CACHE_TTL) {
      return cachedQuotaInfo
    }
  }
  
  const client = getOpenAIClient()
  if (!client) {
    return {
      hasQuota: false,
      error: 'OpenAI API key not configured'
    }
  }
  
  try {
    // Make a minimal API call to check quota
    // Using a very small model and minimal tokens to minimize cost
    const startTime = Date.now()
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    })
    const duration = Date.now() - startTime
    
    // If we got a response, we have quota
    if (response && response.choices && response.choices.length > 0) {
      const result: QuotaInfo = {
        hasQuota: true
      }
      
      // Try to get usage info if available (requires organization API)
      // Note: This is a placeholder - actual usage API requires different endpoints
      cachedQuotaInfo = result
      lastQuotaCheck = new Date()
      
      logInfo('API quota check successful', { duration: `${duration}ms` })
      return result
    }
    
    return {
      hasQuota: false,
      error: 'Unexpected API response'
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    const errorCode = error?.code || error?.status
    
    let quotaInfo: QuotaInfo = {
      hasQuota: false
    }
    
    if (errorCode === 429) {
      if (error?.code === 'insufficient_quota') {
        quotaInfo = {
          hasQuota: false,
          error: 'Insufficient quota - API key has no available credits'
        }
        logWarn('API quota exhausted', { error: errorMessage })
      } else {
        quotaInfo = {
          hasQuota: true, // Rate limit means we have quota, just need to wait
          error: 'Rate limit exceeded - quota available but too many requests'
        }
        logWarn('API rate limit hit', { error: errorMessage })
      }
    } else if (errorCode === 401) {
      quotaInfo = {
        hasQuota: false,
        error: 'Invalid API key'
      }
      logError('Invalid API key', error)
    } else {
      quotaInfo = {
        hasQuota: true, // Assume quota exists if error is not quota-related
        error: `API check failed: ${errorMessage}`
      }
      logWarn('API quota check failed with unknown error', { error: errorMessage, code: errorCode })
    }
    
    cachedQuotaInfo = quotaInfo
    lastQuotaCheck = new Date()
    return quotaInfo
  }
}

/**
 * Check if we should proceed with API calls based on quota
 */
export async function shouldProceedWithAPICalls(): Promise<{
  canProceed: boolean
  reason: string
  quotaInfo?: QuotaInfo
}> {
  const quotaInfo = await checkAPIQuota()
  
  if (!quotaInfo.hasQuota) {
    return {
      canProceed: false,
      reason: quotaInfo.error || 'API quota check failed',
      quotaInfo
    }
  }
  
  if (quotaInfo.error && quotaInfo.error.includes('rate limit')) {
    // Rate limit means we can proceed, just need to wait
    return {
      canProceed: true,
      reason: 'Quota available, but rate limited - will retry with backoff',
      quotaInfo
    }
  }
  
  return {
    canProceed: true,
    reason: 'API quota available',
    quotaInfo
  }
}

/**
 * Track API usage (approximate)
 * Note: This is a simple counter - actual usage tracking requires OpenAI's usage API
 */
let totalTokensUsed = 0
let totalRequests = 0
let dailyTokensUsed = 0
let dailyRequests = 0
let lastDailyReset = new Date()

function resetDailyCounters(): void {
  const now = new Date()
  if (now.getDate() !== lastDailyReset.getDate()) {
    dailyTokensUsed = 0
    dailyRequests = 0
    lastDailyReset = now
    logInfo('Daily API usage counters reset')
  }
}

export function trackAPIUsage(tokens: number): void {
  resetDailyCounters()
  totalTokensUsed += tokens
  dailyTokensUsed += tokens
  totalRequests++
  dailyRequests++
}

export function getAPIUsageStats(): {
  total: { tokens: number; requests: number }
  daily: { tokens: number; requests: number }
} {
  resetDailyCounters()
  return {
    total: {
      tokens: totalTokensUsed,
      requests: totalRequests
    },
    daily: {
      tokens: dailyTokensUsed,
      requests: dailyRequests
    }
  }
}

/**
 * Estimate cost based on token usage
 * Using approximate pricing for gpt-4o-mini (as of 2024)
 */
export function estimateCost(tokens: number, model: string = 'gpt-4o-mini'): number {
  // Approximate pricing per 1M tokens (input/output average)
  const pricing: Record<string, number> = {
    'gpt-4o-mini': 0.15, // $0.15 per 1M tokens
    'gpt-4o': 2.50, // $2.50 per 1M tokens
    'gpt-3.5-turbo': 0.50, // $0.50 per 1M tokens
    'default': 0.15
  }
  
  const pricePerMillion = pricing[model] || pricing.default
  return (tokens / 1_000_000) * pricePerMillion
}

export function logAPIUsageSummary(): void {
  const stats = getAPIUsageStats()
  const estimatedCost = estimateCost(stats.total.tokens)
  const dailyCost = estimateCost(stats.daily.tokens)
  
  logInfo('API Usage Summary', {
    total: {
      tokens: stats.total.tokens.toLocaleString(),
      requests: stats.total.requests,
      estimatedCost: `$${estimatedCost.toFixed(4)}`
    },
    daily: {
      tokens: stats.daily.tokens.toLocaleString(),
      requests: stats.daily.requests,
      estimatedCost: `$${dailyCost.toFixed(4)}`
    }
  })
}

