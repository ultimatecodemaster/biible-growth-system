import { getSystemHealth, getAgentHealth, shouldSkipAgent } from './self-improvement.js'
import { isCircuitBreakerOpen, recordCircuitBreakerSuccess, recordCircuitBreakerFailure, testCircuitBreakerRecovery } from './circuit-breaker.js'

interface HealthCheck {
  timestamp: string
  status: 'healthy' | 'degraded' | 'critical'
  agents: Record<string, {
    healthy: boolean
    successRate: number
    consecutiveFailures: number
  }>
  recommendations: string[]
}

export function performHealthCheck(): HealthCheck {
  const systemHealth = getSystemHealth()
  const timestamp = new Date().toISOString()
  
  console.log(`[Health Monitor] Performing health check at ${timestamp}`)
  console.log(`[Health Monitor] Overall status: ${systemHealth.overallHealth}`)
  
  if (systemHealth.unhealthyAgents.length > 0) {
    console.log(`[Health Monitor] Unhealthy agents: ${systemHealth.unhealthyAgents.join(', ')}`)
  }
  
  if (systemHealth.recommendations.length > 0) {
    console.log(`[Health Monitor] Recommendations:`)
    systemHealth.recommendations.forEach(rec => console.log(`  - ${rec}`))
  }
  
  const agents: Record<string, {
    healthy: boolean
    successRate: number
    consecutiveFailures: number
  }> = {}
  
  const agentNames = [
    'topic_researcher',
    'scripture_mapper',
    'content_composer',
    'seo_metadata',
    'formatter',
    'interlinker',
    'safety_officer',
    'publisher'
  ]
  
  for (const agent of agentNames) {
    const health = getAgentHealth(agent)
    agents[agent] = {
      healthy: health.isHealthy,
      successRate: health.successRate,
      consecutiveFailures: health.consecutiveFailures
    }
  }
  
  return {
    timestamp,
    status: systemHealth.overallHealth,
    agents,
    recommendations: systemHealth.recommendations
  }
}

export function shouldRestartSystem(): {
  shouldRestart: boolean
  reason: string
  waitTime: number
} {
  const health = getSystemHealth()
  
  if (health.overallHealth === 'critical') {
    return {
      shouldRestart: true,
      reason: 'System health is critical. Multiple agents failing.',
      waitTime: 60000 // Wait 1 minute before restart
    }
  }
  
  // Check if any critical agents are failing
  const criticalAgents = ['topic_researcher', 'content_composer', 'safety_officer']
  const criticalFailures = criticalAgents.filter(agent => shouldSkipAgent(agent))
  
  if (criticalFailures.length > 0) {
    return {
      shouldRestart: true,
      reason: `Critical agents failing: ${criticalFailures.join(', ')}`,
      waitTime: 120000 // Wait 2 minutes before restart
    }
  }
  
  return {
    shouldRestart: false,
    reason: 'System is operational',
    waitTime: 0
  }
}

export function canProceedWithAgent(agent: string): {
  canProceed: boolean
  reason: string
} {
  // Check circuit breaker first
  if (isCircuitBreakerOpen(agent)) {
    return {
      canProceed: false,
      reason: `Agent ${agent} circuit breaker is open. Too many failures detected.`
    }
  }
  
  if (shouldSkipAgent(agent)) {
    const health = getAgentHealth(agent)
    return {
      canProceed: false,
      reason: `Agent ${agent} has ${health.consecutiveFailures} consecutive failures. Skipping to prevent further errors.`
    }
  }
  
  return {
    canProceed: true,
    reason: 'Agent is healthy'
  }
}

/**
 * Record agent success for circuit breaker
 */
export function recordAgentSuccess(agent: string): void {
  recordCircuitBreakerSuccess(agent)
}

/**
 * Record agent failure for circuit breaker
 */
export function recordAgentFailure(agent: string): void {
  recordCircuitBreakerFailure(agent)
}

/**
 * Test circuit breaker recovery (call periodically)
 */
export function testRecovery(): void {
  testCircuitBreakerRecovery()
}

