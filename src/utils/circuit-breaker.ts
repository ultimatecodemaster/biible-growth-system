import { logInfo, logWarn } from './logger.js'
import { getAgentHealth } from './self-improvement.js'

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failures: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  nextRetryTime: number | null
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map()

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Open circuit after 5 failures
  successThreshold: 2, // Close circuit after 2 successes in half-open
  timeout: 60000, // 1 minute before attempting recovery
  recoveryTestInterval: 300000 // Test recovery every 5 minutes
}

/**
 * Get or create circuit breaker state for an agent
 */
function getCircuitBreakerState(agent: string): CircuitBreakerState {
  if (!circuitBreakers.has(agent)) {
    circuitBreakers.set(agent, {
      state: 'closed',
      failures: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextRetryTime: null
    })
  }
  return circuitBreakers.get(agent)!
}

/**
 * Record a success for the circuit breaker
 */
export function recordCircuitBreakerSuccess(agent: string): void {
  const state = getCircuitBreakerState(agent)
  
  if (state.state === 'half-open') {
    // In half-open, we need multiple successes to close
    const health = getAgentHealth(agent)
    if (health.consecutiveFailures === 0 && health.successRate > 0.5) {
      state.state = 'closed'
      state.failures = 0
      state.lastSuccessTime = Date.now()
      state.nextRetryTime = null
      logInfo(`[Circuit Breaker] ${agent} circuit closed after successful recovery`)
    }
  } else {
    // In closed state, just reset failures
    state.failures = 0
    state.lastSuccessTime = Date.now()
  }
}

/**
 * Record a failure for the circuit breaker
 */
export function recordCircuitBreakerFailure(agent: string): void {
  const state = getCircuitBreakerState(agent)
  state.failures++
  state.lastFailureTime = Date.now()
  
  if (state.state === 'closed' && state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    state.state = 'open'
    state.nextRetryTime = Date.now() + CIRCUIT_BREAKER_CONFIG.timeout
    logWarn(`[Circuit Breaker] ${agent} circuit opened after ${state.failures} failures`, {
      nextRetryTime: new Date(state.nextRetryTime).toISOString()
    })
  } else if (state.state === 'half-open') {
    // Failure in half-open means we should open again
    state.state = 'open'
    state.nextRetryTime = Date.now() + CIRCUIT_BREAKER_CONFIG.timeout
    logWarn(`[Circuit Breaker] ${agent} circuit reopened after failure in half-open state`)
  }
}

/**
 * Check if circuit breaker allows the operation
 */
export function isCircuitBreakerOpen(agent: string): boolean {
  const state = getCircuitBreakerState(agent)
  
  if (state.state === 'closed') {
    return false // Circuit is closed, allow operations
  }
  
  if (state.state === 'open') {
    // Check if we should attempt recovery
    if (state.nextRetryTime && Date.now() >= state.nextRetryTime) {
      // Transition to half-open for recovery testing
      state.state = 'half-open'
      state.failures = 0
      logInfo(`[Circuit Breaker] ${agent} circuit entering half-open state for recovery testing`)
      return false // Allow one operation to test recovery
    }
    return true // Circuit is open, block operations
  }
  
  // Half-open state - allow operations but monitor closely
  return false
}

/**
 * Get circuit breaker status for an agent
 */
export function getCircuitBreakerStatus(agent: string): {
  state: 'closed' | 'open' | 'half-open'
  failures: number
  canProceed: boolean
  nextRetryTime: string | null
} {
  const state = getCircuitBreakerState(agent)
  const canProceed = !isCircuitBreakerOpen(agent)
  
  return {
    state: state.state,
    failures: state.failures,
    canProceed,
    nextRetryTime: state.nextRetryTime ? new Date(state.nextRetryTime).toISOString() : null
  }
}

/**
 * Test circuit breaker recovery for all open circuits
 * This should be called periodically to test if circuits can be recovered
 */
export function testCircuitBreakerRecovery(): void {
  const now = Date.now()
  let testedCount = 0
  
  for (const [agent, state] of circuitBreakers.entries()) {
    if (state.state === 'open' && state.nextRetryTime && now >= state.nextRetryTime) {
      // Check agent health to see if it's recovered
      const health = getAgentHealth(agent)
      
      // If agent has recent successes, try to recover
      if (health.consecutiveFailures === 0 && health.successRate > 0.3) {
        state.state = 'half-open'
        state.failures = 0
        logInfo(`[Circuit Breaker] ${agent} circuit entering half-open state for recovery testing (health-based)`)
        testedCount++
      } else if (now - (state.nextRetryTime || 0) > CIRCUIT_BREAKER_CONFIG.recoveryTestInterval) {
        // Force recovery test if enough time has passed
        state.state = 'half-open'
        state.failures = 0
        state.nextRetryTime = now + CIRCUIT_BREAKER_CONFIG.timeout
        logInfo(`[Circuit Breaker] ${agent} circuit entering half-open state for forced recovery test`)
        testedCount++
      }
    }
  }
  
  if (testedCount > 0) {
    logInfo(`[Circuit Breaker] Tested recovery for ${testedCount} circuit(s)`)
  }
}

/**
 * Reset circuit breaker for an agent (manual override)
 */
export function resetCircuitBreaker(agent: string): void {
  const state = getCircuitBreakerState(agent)
  state.state = 'closed'
  state.failures = 0
  state.lastFailureTime = null
  state.nextRetryTime = null
  logInfo(`[Circuit Breaker] ${agent} circuit manually reset`)
}

/**
 * Get summary of all circuit breakers
 */
export function getCircuitBreakerSummary(): Record<string, {
  state: string
  failures: number
  canProceed: boolean
}> {
  const summary: Record<string, {
    state: string
    failures: number
    canProceed: boolean
  }> = {}
  
  for (const [agent, state] of circuitBreakers.entries()) {
    summary[agent] = {
      state: state.state,
      failures: state.failures,
      canProceed: !isCircuitBreakerOpen(agent)
    }
  }
  
  return summary
}

