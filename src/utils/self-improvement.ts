import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync, unlinkSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'

interface ErrorRecord {
  timestamp: string
  agent: string
  errorType: string
  errorMessage: string
  context?: Record<string, unknown>
  resolved: boolean
  resolution?: string
}

interface LearningData {
  errorPatterns: Record<string, {
    count: number
    lastOccurred: string
    commonContexts: string[]
    suggestedFix?: string
  }>
  agentHealth: Record<string, {
    successRate: number
    lastSuccess: string | null
    lastFailure: string | null
    consecutiveFailures: number
  }>
  recoveryStrategies: Record<string, string[]>
  improvements: Array<{
    timestamp: string
    change: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
}

const LEARNING_DATA_PATH = join(process.cwd(), 'data', 'learning.json')

function loadLearningData(): LearningData {
  const initial: LearningData = {
    errorPatterns: {},
    agentHealth: {},
    recoveryStrategies: {},
    improvements: []
  }
  
  if (!existsSync(LEARNING_DATA_PATH)) {
    ensureDirSync(join(process.cwd(), 'data'))
    writeFileSync(LEARNING_DATA_PATH, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
  
  // Try to load main file first
  try {
    const content = readFileSync(LEARNING_DATA_PATH, 'utf-8')
    const parsed = JSON.parse(content) as LearningData
    
    // Validate structure
    if (typeof parsed !== 'object' || !parsed.errorPatterns || !parsed.agentHealth) {
      throw new Error('Invalid learning data structure')
    }
    
    return parsed
  } catch (error) {
    console.error('[Self-Improvement] Failed to load learning data from main file, trying backup:', error)
    
    // Try to load from backup
    const backupPath = `${LEARNING_DATA_PATH}.bak`
    if (existsSync(backupPath)) {
      try {
        const backupContent = readFileSync(backupPath, 'utf-8')
        const parsed = JSON.parse(backupContent) as LearningData
        
        // Validate structure
        if (typeof parsed !== 'object' || !parsed.errorPatterns || !parsed.agentHealth) {
          throw new Error('Invalid backup data structure')
        }
        
        // Restore backup to main file
        copyFileSync(backupPath, LEARNING_DATA_PATH)
        console.log('[Self-Improvement] Restored learning data from backup')
        return parsed
      } catch (backupError) {
        console.error('[Self-Improvement] Failed to load from backup, resetting:', backupError)
      }
    }
    
    // If all else fails, reset to initial state
    console.error('[Self-Improvement] Resetting learning data to initial state')
    writeFileSync(LEARNING_DATA_PATH, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

function saveLearningData(data: LearningData): void {
  try {
    // Atomic write: write to temp file first, then rename
    // This prevents corruption if process crashes during write
    const tempPath = `${LEARNING_DATA_PATH}.tmp`
    const backupPath = `${LEARNING_DATA_PATH}.bak`
    
    // Create backup of current file if it exists
    if (existsSync(LEARNING_DATA_PATH)) {
      try {
        copyFileSync(LEARNING_DATA_PATH, backupPath)
      } catch (backupError) {
        // Backup failure is not critical, continue
        console.warn('[Self-Improvement] Failed to create backup, continuing:', backupError)
      }
    }
    
    // Write to temp file
    writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    
    // Atomic rename (rename is atomic on most filesystems)
    renameSync(tempPath, LEARNING_DATA_PATH)
    
    // Clean up old backup after successful write
    if (existsSync(backupPath)) {
      try {
        unlinkSync(backupPath)
      } catch (cleanupError) {
        // Cleanup failure is not critical
      }
    }
  } catch (error) {
    console.error('[Self-Improvement] Failed to save learning data:', error)
    
    // Try to restore from backup if main file is corrupted
    const backupPath = `${LEARNING_DATA_PATH}.bak`
    if (existsSync(backupPath) && !existsSync(LEARNING_DATA_PATH)) {
      try {
        copyFileSync(backupPath, LEARNING_DATA_PATH)
        console.log('[Self-Improvement] Restored learning data from backup')
      } catch (restoreError) {
        console.error('[Self-Improvement] Failed to restore from backup:', restoreError)
      }
    }
  }
}

export function recordError(
  agent: string,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  console.log(`[Self-Improvement] Recording error from ${agent}`)
  
  const data = loadLearningData()
  const timestamp = new Date().toISOString()
  
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorType = error instanceof Error ? error.constructor.name : typeof error
  
  // Track error pattern
  const patternKey = `${agent}:${errorType}`
  if (!data.errorPatterns[patternKey]) {
    data.errorPatterns[patternKey] = {
      count: 0,
      lastOccurred: timestamp,
      commonContexts: [],
      suggestedFix: undefined
    }
  }
  
  data.errorPatterns[patternKey].count++
  data.errorPatterns[patternKey].lastOccurred = timestamp
  
  // Track agent health
  if (!data.agentHealth[agent]) {
    data.agentHealth[agent] = {
      successRate: 1.0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0
    }
  }
  
  const health = data.agentHealth[agent]
  health.lastFailure = timestamp
  health.consecutiveFailures++
  
  // Adjust success rate (exponential moving average)
  health.successRate = health.successRate * 0.9 // Decay success rate on failure
  
  // Analyze error and suggest fixes
  if (data.errorPatterns[patternKey].count >= 3) {
    const suggestion = analyzeErrorAndSuggestFix(agent, errorType, errorMessage, context)
    if (suggestion) {
      data.errorPatterns[patternKey].suggestedFix = suggestion
      console.log(`[Self-Improvement] Suggested fix for ${patternKey}: ${suggestion}`)
    }
  }
  
  saveLearningData(data)
}

export function recordSuccess(agent: string): void {
  const data = loadLearningData()
  const timestamp = new Date().toISOString()
  
  if (!data.agentHealth[agent]) {
    data.agentHealth[agent] = {
      successRate: 1.0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0
    }
  }
  
  const health = data.agentHealth[agent]
  health.lastSuccess = timestamp
  health.consecutiveFailures = 0
  health.successRate = Math.min(1.0, health.successRate * 0.95 + 0.05) // Increase success rate
  
  saveLearningData(data)
}

function analyzeErrorAndSuggestFix(
  agent: string,
  errorType: string,
  errorMessage: string,
  context?: Record<string, unknown>
): string | undefined {
  const lowerMessage = errorMessage.toLowerCase()
  
  // Pattern-based suggestions
  if (lowerMessage.includes('quota') || lowerMessage.includes('insufficient_quota')) {
    return 'API quota exceeded. Consider reducing batch size or adding rate limiting delays.'
  }
  
  if (lowerMessage.includes('rate_limit') || lowerMessage.includes('429')) {
    return 'Rate limit hit. Implement exponential backoff with jitter.'
  }
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Request timeout. Consider increasing timeout duration or breaking into smaller chunks.'
  }
  
  if (lowerMessage.includes('parse') || lowerMessage.includes('json')) {
    return 'Parsing error. Add validation and fallback parsing strategies.'
  }
  
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'Network error. Implement retry logic with exponential backoff.'
  }
  
  if (lowerMessage.includes('empty') || lowerMessage.includes('null')) {
    return 'Empty response. Add validation checks before processing.'
  }
  
  return undefined
}

export function getAgentHealth(agent: string): {
  successRate: number
  consecutiveFailures: number
  isHealthy: boolean
  suggestedAction?: string
} {
  const data = loadLearningData()
  const health = data.agentHealth[agent]
  
  if (!health) {
    return {
      successRate: 1.0,
      consecutiveFailures: 0,
      isHealthy: true
    }
  }
  
  const isHealthy = health.successRate > 0.5 && health.consecutiveFailures < 5
  
  let suggestedAction: string | undefined
  if (health.consecutiveFailures >= 3) {
    suggestedAction = 'Consider skipping this agent temporarily or using fallback strategy'
  } else if (health.successRate < 0.3) {
    suggestedAction = 'Agent showing poor performance. Review error patterns and adjust approach'
  }
  
  return {
    successRate: health.successRate,
    consecutiveFailures: health.consecutiveFailures,
    isHealthy,
    suggestedAction
  }
}

export function getRecoveryStrategy(error: Error | unknown, agent: string): {
  shouldRetry: boolean
  waitTime: number
  strategy: string
} {
  const data = loadLearningData()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const lowerMessage = errorMessage.toLowerCase()
  
  // Check if we have a learned recovery strategy
  const patternKey = `${agent}:${errorMessage}`
  if (data.recoveryStrategies[patternKey] && data.recoveryStrategies[patternKey].length > 0) {
    const strategy = data.recoveryStrategies[patternKey][0]
    return {
      shouldRetry: true,
      waitTime: calculateWaitTime(agent, error),
      strategy
    }
  }
  
  // Default recovery strategies based on error type
  if (lowerMessage.includes('rate_limit') || lowerMessage.includes('429')) {
    return {
      shouldRetry: true,
      waitTime: 60000, // 1 minute
      strategy: 'Rate limit detected. Waiting before retry.'
    }
  }
  
  if (lowerMessage.includes('quota')) {
    return {
      shouldRetry: false,
      waitTime: 0,
      strategy: 'Quota exceeded. Cannot recover automatically.'
    }
  }
  
  if (lowerMessage.includes('timeout')) {
    return {
      shouldRetry: true,
      waitTime: 5000, // 5 seconds
      strategy: 'Timeout error. Retrying with short delay.'
    }
  }
  
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return {
      shouldRetry: true,
      waitTime: 10000, // 10 seconds
      strategy: 'Network error. Retrying with delay.'
    }
  }
  
  // Default: retry with exponential backoff
  return {
    shouldRetry: true,
    waitTime: calculateWaitTime(agent, error),
    strategy: 'Generic error. Retrying with exponential backoff.'
  }
}

function calculateWaitTime(agent: string, error: Error | unknown): number {
  const data = loadLearningData()
  const health = data.agentHealth[agent]
  
  if (!health) {
    return 5000 // Default 5 seconds
  }
  
  // Exponential backoff based on consecutive failures
  const baseWait = 5000 // 5 seconds
  const maxWait = 300000 // 5 minutes
  const waitTime = Math.min(baseWait * Math.pow(2, health.consecutiveFailures), maxWait)
  
  // Add jitter (random 0-20% variation)
  const jitter = waitTime * 0.2 * Math.random()
  
  return Math.floor(waitTime + jitter)
}

export function recordImprovement(change: string, impact: 'positive' | 'negative' | 'neutral'): void {
  const data = loadLearningData()
  const timestamp = new Date().toISOString()
  
  data.improvements.push({
    timestamp,
    change,
    impact
  })
  
  // Keep only last 100 improvements
  if (data.improvements.length > 100) {
    data.improvements = data.improvements.slice(-100)
  }
  
  saveLearningData(data)
  console.log(`[Self-Improvement] Recorded improvement: ${change} (${impact})`)
}

export function getSystemHealth(): {
  overallHealth: 'healthy' | 'degraded' | 'critical'
  unhealthyAgents: string[]
  recommendations: string[]
} {
  const data = loadLearningData()
  const unhealthyAgents: string[] = []
  const recommendations: string[] = []
  
  for (const [agent, health] of Object.entries(data.agentHealth)) {
    if (health.successRate < 0.5 || health.consecutiveFailures >= 5) {
      unhealthyAgents.push(agent)
      
      if (health.consecutiveFailures >= 5) {
        recommendations.push(`${agent} has ${health.consecutiveFailures} consecutive failures. Consider disabling temporarily.`)
      } else if (health.successRate < 0.3) {
        recommendations.push(`${agent} has low success rate (${(health.successRate * 100).toFixed(1)}%). Review error patterns.`)
      }
    }
  }
  
  let overallHealth: 'healthy' | 'degraded' | 'critical'
  if (unhealthyAgents.length === 0) {
    overallHealth = 'healthy'
  } else if (unhealthyAgents.length <= 2) {
    overallHealth = 'degraded'
  } else {
    overallHealth = 'critical'
  }
  
  return {
    overallHealth,
    unhealthyAgents,
    recommendations
  }
}

export function shouldSkipAgent(agent: string): boolean {
  const health = getAgentHealth(agent)
  return !health.isHealthy && health.consecutiveFailures >= 5
}

