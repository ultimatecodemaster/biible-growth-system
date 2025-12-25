import { logInfo, logWarn } from './logger.js'

interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  timestamp: string
}

let memoryCheckInterval: NodeJS.Timeout | null = null
let maxMemoryUsage = 0
let memoryLeakThreshold = 1024 * 1024 * 1024 // 1GB default threshold
let checkInterval = 60000 // Check every minute

/**
 * Get current memory usage
 */
export function getMemoryUsage(): MemoryStats {
  const usage = process.memoryUsage()
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    timestamp: new Date().toISOString()
  }
}

/**
 * Format memory size in human-readable format
 */
function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Log current memory usage
 */
export function logMemoryUsage(context?: string): void {
  const mem = getMemoryUsage()
  const contextStr = context ? `[${context}] ` : ''
  logInfo(`${contextStr}Memory usage:`, {
    heapUsed: formatMemory(mem.heapUsed),
    heapTotal: formatMemory(mem.heapTotal),
    rss: formatMemory(mem.rss),
    external: formatMemory(mem.external)
  })
}

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring(options?: {
  interval?: number
  threshold?: number
  onLeakDetected?: (stats: MemoryStats) => void
}): void {
  if (memoryCheckInterval) {
    logWarn('Memory monitoring already started')
    return
  }
  
  checkInterval = options?.interval || 60000
  memoryLeakThreshold = options?.threshold || 1024 * 1024 * 1024
  
  logInfo('Starting memory monitoring', {
    interval: `${checkInterval / 1000}s`,
    threshold: formatMemory(memoryLeakThreshold)
  })
  
  memoryCheckInterval = setInterval(() => {
    const mem = getMemoryUsage()
    
    // Track max memory usage
    if (mem.heapUsed > maxMemoryUsage) {
      maxMemoryUsage = mem.heapUsed
    }
    
    // Check for potential memory leak
    if (mem.heapUsed > memoryLeakThreshold) {
      logWarn('High memory usage detected', {
        heapUsed: formatMemory(mem.heapUsed),
        threshold: formatMemory(memoryLeakThreshold),
        rss: formatMemory(mem.rss)
      })
      
      if (options?.onLeakDetected) {
        options.onLeakDetected(mem)
      }
      
      // Suggest garbage collection if available
      if (global.gc) {
        logInfo('Running garbage collection...')
        global.gc()
        const afterGC = getMemoryUsage()
        logInfo('Memory after GC', {
          heapUsed: formatMemory(afterGC.heapUsed),
          freed: formatMemory(mem.heapUsed - afterGC.heapUsed)
        })
      }
    }
    
    // Log memory usage periodically (every 10 checks = ~10 minutes)
    if (Math.random() < 0.1) {
      logMemoryUsage('Memory Monitor')
    }
  }, checkInterval)
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitoring(): void {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval)
    memoryCheckInterval = null
    logInfo('Stopped memory monitoring')
  }
}

/**
 * Get memory statistics summary
 */
export function getMemoryStats(): {
  current: MemoryStats
  max: number
  maxFormatted: string
} {
  return {
    current: getMemoryUsage(),
    max: maxMemoryUsage,
    maxFormatted: formatMemory(maxMemoryUsage)
  }
}

/**
 * Cleanup function to clear timers and references
 * Call this periodically to help prevent memory leaks
 */
export function performMemoryCleanup(): void {
  // Force garbage collection if available
  if (global.gc) {
    const before = getMemoryUsage()
    global.gc()
    const after = getMemoryUsage()
    const freed = before.heapUsed - after.heapUsed
    
    if (freed > 0) {
      logInfo('Memory cleanup performed', {
        freed: formatMemory(freed),
        before: formatMemory(before.heapUsed),
        after: formatMemory(after.heapUsed)
      })
    }
  }
}

/**
 * Initialize memory monitoring with Node.js flags if needed
 */
export function initializeMemoryMonitoring(): void {
  // Check if --expose-gc flag is set (needed for manual GC)
  if (!global.gc) {
    logInfo('Note: Run with --expose-gc flag to enable manual garbage collection')
    logInfo('Example: node --expose-gc dist/index.js')
  }
  
  // Start monitoring
  startMemoryMonitoring({
    interval: parseInt(process.env.MEMORY_CHECK_INTERVAL || '60000'),
    threshold: parseInt(process.env.MEMORY_LEAK_THRESHOLD || String(1024 * 1024 * 1024)),
    onLeakDetected: (stats) => {
      logWarn('Potential memory leak detected', {
        heapUsed: formatMemory(stats.heapUsed),
        rss: formatMemory(stats.rss)
      })
    }
  })
}

