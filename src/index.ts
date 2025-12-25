import 'dotenv/config'
import { runOrchestrator } from './orchestrator.js'
import { shouldRestartSystem, performHealthCheck } from './utils/health-monitor.js'
import { recordError, recordImprovement } from './utils/self-improvement.js'
import { logWithTime, logError as loggerError } from './utils/logger.js'
import { performDiskCleanup } from './utils/disk-management.js'
import { initializeLearningPersistence, finalizeLearningPersistence } from './utils/learning-persistence.js'
import { initializeMemoryMonitoring, stopMemoryMonitoring, performMemoryCleanup, logMemoryUsage } from './utils/memory-monitor.js'
import { shouldProceedWithAPICalls, logAPIUsageSummary } from './utils/api-quota-monitor.js'

// Graceful shutdown state
let isShuttingDown = false
let shutdownTimeout: NodeJS.Timeout | null = null
let currentRunPromise: Promise<void> | null = null

function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logWithTime(`[MAIN] Already shutting down, forcing exit...`)
    process.exit(1)
    return
  }
  
  isShuttingDown = true
  logWithTime(`[MAIN] Received ${signal}, initiating graceful shutdown...`)
  
  // Wait for current run to complete (with timeout)
  if (currentRunPromise) {
    logWithTime(`[MAIN] Waiting for current run to complete (max 5 minutes)...`)
    try {
      await Promise.race([
        currentRunPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), 300000) // 5 minutes
        )
      ])
      logWithTime(`[MAIN] Current run completed`)
    } catch (error) {
      logWithTime(`[MAIN] Current run did not complete in time, proceeding with shutdown`)
    }
  }
  
  // Save learning data
  try {
    logWithTime(`[MAIN] Saving learning data...`)
    finalizeLearningPersistence()
  } catch (error) {
    loggerError(`[MAIN] Failed to save learning data during shutdown`, error)
  }
  
  // Stop memory monitoring
  stopMemoryMonitoring()
  
  // Force exit after a short delay if still running
  shutdownTimeout = setTimeout(() => {
    logWithTime(`[MAIN] Forcing exit after shutdown delay`)
    process.exit(0)
  }, 5000) // 5 second grace period
  
  logWithTime(`[MAIN] Graceful shutdown complete`)
  process.exit(0)
}

// Register signal handlers
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((error) => {
    loggerError(`[MAIN] Error during SIGTERM shutdown`, error)
    process.exit(1)
  })
})

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((error) => {
    loggerError(`[MAIN] Error during SIGINT shutdown`, error)
    process.exit(1)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggerError(`[MAIN] Uncaught exception`, error)
  recordError('main', error, { type: 'uncaughtException' })
  
  // Attempt graceful shutdown
  gracefulShutdown('uncaughtException').catch(() => {
    process.exit(1)
  })
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  loggerError(`[MAIN] Unhandled promise rejection`, reason as Error, { promise })
  recordError('main', reason, { type: 'unhandledRejection' })
  
  // Attempt graceful shutdown
  gracefulShutdown('unhandledRejection').catch(() => {
    process.exit(1)
  })
})

async function main() {
  logWithTime('='.repeat(60))
  logWithTime('Biible Autonomous Growth System - Initializing')
  logWithTime('='.repeat(60))
  logWithTime(`CLOUD_MODE: ${process.env.CLOUD_MODE || 'false'}`)
  
  // Initialize learning data persistence (load from artifact if in GitHub Actions)
  initializeLearningPersistence()
  
  // Initialize memory monitoring
  initializeMemoryMonitoring()
  
  // Log initial memory usage
  logMemoryUsage('Initialization')
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }
  
  // Continuous mode - keep running after each batch
  let runCount = 0
  let consecutiveFailures = 0
  const maxRuns = process.env.MAX_RUNS ? parseInt(process.env.MAX_RUNS) : Infinity
  const maxConsecutiveFailures = 5
  const diskCleanupInterval = parseInt(process.env.DISK_CLEANUP_INTERVAL || '10') // Cleanup every N runs
  
  while (runCount < maxRuns) {
    runCount++
    const timestamp = getTimestamp()
    logWithTime(`\n${'='.repeat(60)}`)
    logWithTime(`Starting run #${runCount}`)
    logWithTime(`${'='.repeat(60)}\n`)
    
    // Perform health check before each run
    const healthCheck = performHealthCheck()
    const restartDecision = shouldRestartSystem()
    
    // Check API quota before proceeding
    const quotaCheck = await shouldProceedWithAPICalls()
    if (!quotaCheck.canProceed) {
      logWithTime(`[MAIN] Cannot proceed: ${quotaCheck.reason}`)
      logWithTime(`[MAIN] Waiting 5 minutes before retrying quota check...`)
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000))
      continue
    }
    
    if (restartDecision.shouldRestart) {
      logWithTime(`[MAIN] System restart recommended: ${restartDecision.reason}`)
      logWithTime(`[MAIN] Waiting ${restartDecision.waitTime / 1000}s before restart...`)
      await new Promise(resolve => setTimeout(resolve, restartDecision.waitTime))
      logWithTime(`[MAIN] Restarting system...`)
      consecutiveFailures = 0 // Reset on restart
      continue
    }
    
    // Check if shutdown was requested
    if (isShuttingDown) {
      logWithTime(`[MAIN] Shutdown requested, stopping run loop`)
      break
    }
    
    try {
      // Track current run for graceful shutdown
      currentRunPromise = runOrchestrator()
      await currentRunPromise
      currentRunPromise = null
      
      // Success - reset failure counter and record improvement
      if (consecutiveFailures > 0) {
        logWithTime(`[MAIN] System recovered after ${consecutiveFailures} consecutive failures`)
        recordImprovement(`System recovered after ${consecutiveFailures} failures`, 'positive')
      }
      consecutiveFailures = 0
      
      // Periodic disk cleanup, memory cleanup, API usage summary, and circuit breaker recovery testing
      if (runCount % diskCleanupInterval === 0) {
        // Log API usage summary
        logAPIUsageSummary()
        
        // Test circuit breaker recovery
        const { testRecovery } = await import('./utils/health-monitor.js')
        testRecovery()
        try {
          performDiskCleanup({
            maxDraftAge: parseInt(process.env.MAX_DRAFT_AGE || '30'),
            maxFlaggedAge: parseInt(process.env.MAX_FLAGGED_AGE || '90'),
            maxDraftCount: parseInt(process.env.MAX_DRAFT_COUNT || '1000')
          })
        } catch (error) {
          loggerError(`[MAIN] Disk cleanup failed`, error)
          // Don't fail the run if cleanup fails
        }
        
        // Perform memory cleanup
        try {
          performMemoryCleanup()
          logMemoryUsage('After Cleanup')
        } catch (error) {
          loggerError(`[MAIN] Memory cleanup failed`, error)
        }
      }
      
      // Check if shutdown was requested before waiting
      if (isShuttingDown) {
        logWithTime(`[MAIN] Shutdown requested, stopping run loop`)
        break
      }
      
      // Wait time between runs - default to 1 hour to control API costs
      // Can be overridden with RUN_INTERVAL_MINUTES environment variable
      const runIntervalMinutes = parseInt(process.env.RUN_INTERVAL_MINUTES || '60')
      const waitTime = runIntervalMinutes * 60 * 1000
      logWithTime(`\n[MAIN] Run #${runCount} complete. Waiting ${runIntervalMinutes} minute(s) before next run...`)
      logWithTime(`[MAIN] To change interval, set RUN_INTERVAL_MINUTES environment variable (current: ${runIntervalMinutes} min)`)
      logWithTime(`Press Ctrl+C to stop.\n`)
      
      // Wait with periodic shutdown check
      const waitStart = Date.now()
      while (Date.now() - waitStart < waitTime) {
        if (isShuttingDown) {
          logWithTime(`[MAIN] Shutdown requested during wait, stopping`)
          break
        }
        await new Promise(resolve => setTimeout(resolve, 1000)) // Check every second
      }
    } catch (error) {
      consecutiveFailures++
      logWithTime(`[MAIN] Error in run #${runCount} (Consecutive failures: ${consecutiveFailures})`)
      loggerError(`[MAIN] Error details`, error, { runCount, consecutiveFailures })
      recordError('main', error, { runCount, consecutiveFailures })
      
      // Check if we should restart
      const restartDecision = shouldRestartSystem()
      if (restartDecision.shouldRestart || consecutiveFailures >= maxConsecutiveFailures) {
        const reason = consecutiveFailures >= maxConsecutiveFailures
          ? `Maximum consecutive failures reached (${maxConsecutiveFailures})`
          : restartDecision.reason
        
        logWithTime(`[MAIN] System restart required: ${reason}`)
        logWithTime(`[MAIN] Waiting ${restartDecision.waitTime / 1000}s before restart...`)
        
        // Exponential backoff for restart delay
        const restartDelay = Math.min(
          restartDecision.waitTime * Math.pow(2, Math.min(consecutiveFailures - 1, 3)),
          600000 // Max 10 minutes
        )
        
        await new Promise(resolve => setTimeout(resolve, restartDelay))
        logWithTime(`[MAIN] Restarting system...`)
        consecutiveFailures = 0 // Reset on restart
        continue
      }
      
      // Regular retry with exponential backoff
      const baseWait = 30000 // 30 seconds
      const waitTime = Math.min(
        baseWait * Math.pow(2, Math.min(consecutiveFailures - 1, 4)),
        300000 // Max 5 minutes
      )
      // Check if shutdown was requested before retry
      if (isShuttingDown) {
        logWithTime(`[MAIN] Shutdown requested, stopping retry loop`)
        break
      }
      
      const waitSeconds = waitTime / 1000
      logWithTime(`[MAIN] Waiting ${waitSeconds}s before retrying (exponential backoff)...\n`)
      
      // Wait with periodic shutdown check
      const waitStart = Date.now()
      while (Date.now() - waitStart < waitTime) {
        if (isShuttingDown) {
          logWithTime(`[MAIN] Shutdown requested during retry wait, stopping`)
          break
        }
        await new Promise(resolve => setTimeout(resolve, 1000)) // Check every second
      }
    }
  }
  
  if (isShuttingDown) {
    logWithTime(`\n[MAIN] Shutdown requested, stopping.`)
  } else {
    logWithTime(`\n[MAIN] Reached max runs (${maxRuns}). Stopping.`)
  }
  
  // Save learning data as artifact before exit
  finalizeLearningPersistence()
  
  // Stop memory monitoring
  stopMemoryMonitoring()
  
  // Final memory usage log
  logMemoryUsage('Final')
  
  // Clear shutdown timeout if set
  if (shutdownTimeout) {
    clearTimeout(shutdownTimeout)
  }
}

// Enhanced error handling with process-level recovery
main().catch((error) => {
  logWithTime('[MAIN] Fatal error caught at process level')
  loggerError('[MAIN] Fatal error details', error, { type: 'fatal', level: 'process' })
  recordError('main', error, { type: 'fatal', level: 'process' })
  
  // Save learning data before exit
  try {
    finalizeLearningPersistence()
  } catch (persistError) {
    loggerError('[MAIN] Failed to save learning data on fatal error', persistError)
  }
  
  // Attempt graceful restart
  logWithTime('[MAIN] Attempting to restart after fatal error...')
  setTimeout(() => {
    logWithTime('[MAIN] Restarting process...')
    process.exit(1) // Exit and let process manager restart if available
  }, 10000) // Wait 10 seconds before exit
})

