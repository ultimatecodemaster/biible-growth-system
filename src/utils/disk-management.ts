import { readdirSync, statSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { logWithTime, logInfo, logWarn } from './logger.js'

interface CleanupOptions {
  maxDraftAge?: number // Days to keep drafts (default: 30)
  maxFlaggedAge?: number // Days to keep flagged content (default: 90)
  maxDraftCount?: number // Maximum number of drafts to keep (default: 1000)
  archiveOldFiles?: boolean // Archive instead of delete (default: false)
}

const DEFAULT_OPTIONS: Required<CleanupOptions> = {
  maxDraftAge: 30,
  maxFlaggedAge: 90,
  maxDraftCount: 1000,
  archiveOldFiles: false
}

function getFileAge(filePath: string): number {
  try {
    const stats = statSync(filePath)
    const now = Date.now()
    const fileTime = stats.mtime.getTime()
    return Math.floor((now - fileTime) / (1000 * 60 * 60 * 24)) // Age in days
  } catch (error) {
    logWarn(`Failed to get file age for ${filePath}`, { error })
    return 0
  }
}

function archiveFile(filePath: string, archiveDir: string): void {
  try {
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown'
    const archivePath = join(archiveDir, fileName)
    
    // In a real implementation, you'd move the file
    // For now, we'll just log that we would archive it
    logInfo(`Would archive ${filePath} to ${archivePath}`)
  } catch (error) {
    logWarn(`Failed to archive file ${filePath}`, { error })
  }
}

export function cleanupDrafts(options: CleanupOptions = {}): {
  deleted: number
  archived: number
  errors: number
} {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const draftsDir = join(process.cwd(), 'data', 'drafts')
  const archiveDir = join(process.cwd(), 'data', 'archived', 'drafts')
  
  if (!existsSync(draftsDir)) {
    logInfo(`Drafts directory does not exist: ${draftsDir}`)
    return { deleted: 0, archived: 0, errors: 0 }
  }
  
  if (opts.archiveOldFiles && !existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true })
  }
  
  let deleted = 0
  let archived = 0
  let errors = 0
  
  try {
    const files = readdirSync(draftsDir)
    const fileStats = files
      .map(file => {
        const filePath = join(draftsDir, file)
        try {
          return {
            path: filePath,
            name: file,
            age: getFileAge(filePath),
            size: statSync(filePath).size
          }
        } catch (error) {
          logWarn(`Failed to stat file ${filePath}`, { error })
          return null
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.age - a.age) // Sort by age, oldest first
    
    // Delete files older than maxDraftAge
    for (const file of fileStats) {
      if (file.age > opts.maxDraftAge) {
        try {
          if (opts.archiveOldFiles) {
            archiveFile(file.path, archiveDir)
            archived++
          } else {
            unlinkSync(file.path)
            deleted++
            logInfo(`Deleted old draft: ${file.name} (${file.age} days old)`)
          }
        } catch (error) {
          errors++
          logWarn(`Failed to delete/archive draft ${file.name}`, { error })
        }
      }
    }
    
    // If we still have too many files, delete the oldest ones
    const remainingFiles = fileStats.filter(f => f.age <= opts.maxDraftAge)
    if (remainingFiles.length > opts.maxDraftCount) {
      const toDelete = remainingFiles.slice(opts.maxDraftCount)
      for (const file of toDelete) {
        try {
          if (opts.archiveOldFiles) {
            archiveFile(file.path, archiveDir)
            archived++
          } else {
            unlinkSync(file.path)
            deleted++
            logInfo(`Deleted draft to maintain count limit: ${file.name}`)
          }
        } catch (error) {
          errors++
          logWarn(`Failed to delete/archive draft ${file.name}`, { error })
        }
      }
    }
    
    logInfo(`Draft cleanup complete: ${deleted} deleted, ${archived} archived, ${errors} errors`)
  } catch (error) {
    logWarn(`Failed to cleanup drafts directory`, { error })
    errors++
  }
  
  return { deleted, archived, errors }
}

export function cleanupFlagged(options: CleanupOptions = {}): {
  deleted: number
  archived: number
  errors: number
} {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const flaggedDir = join(process.cwd(), 'data', 'flagged')
  const archiveDir = join(process.cwd(), 'data', 'archived', 'flagged')
  
  if (!existsSync(flaggedDir)) {
    logInfo(`Flagged directory does not exist: ${flaggedDir}`)
    return { deleted: 0, archived: 0, errors: 0 }
  }
  
  if (opts.archiveOldFiles && !existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true })
  }
  
  let deleted = 0
  let archived = 0
  let errors = 0
  
  try {
    const files = readdirSync(flaggedDir)
    
    for (const file of files) {
      const filePath = join(flaggedDir, file)
      const age = getFileAge(filePath)
      
      if (age > opts.maxFlaggedAge) {
        try {
          if (opts.archiveOldFiles) {
            archiveFile(filePath, archiveDir)
            archived++
          } else {
            unlinkSync(filePath)
            deleted++
            logInfo(`Deleted old flagged content: ${file} (${age} days old)`)
          }
        } catch (error) {
          errors++
          logWarn(`Failed to delete/archive flagged content ${file}`, { error })
        }
      }
    }
    
    logInfo(`Flagged content cleanup complete: ${deleted} deleted, ${archived} archived, ${errors} errors`)
  } catch (error) {
    logWarn(`Failed to cleanup flagged directory`, { error })
    errors++
  }
  
  return { deleted, archived, errors }
}

export function getDiskUsage(): {
  drafts: { count: number; totalSize: number }
  flagged: { count: number; totalSize: number }
  learning: { size: number }
} {
  const draftsDir = join(process.cwd(), 'data', 'drafts')
  const flaggedDir = join(process.cwd(), 'data', 'flagged')
  const learningPath = join(process.cwd(), 'data', 'learning.json')
  
  let draftsCount = 0
  let draftsSize = 0
  let flaggedCount = 0
  let flaggedSize = 0
  let learningSize = 0
  
  try {
    if (existsSync(draftsDir)) {
      const files = readdirSync(draftsDir)
      draftsCount = files.length
      for (const file of files) {
        try {
          const stats = statSync(join(draftsDir, file))
          draftsSize += stats.size
        } catch (error) {
          // Skip files we can't stat
        }
      }
    }
  } catch (error) {
    logWarn(`Failed to calculate drafts disk usage`, { error })
  }
  
  try {
    if (existsSync(flaggedDir)) {
      const files = readdirSync(flaggedDir)
      flaggedCount = files.length
      for (const file of files) {
        try {
          const stats = statSync(join(flaggedDir, file))
          flaggedSize += stats.size
        } catch (error) {
          // Skip files we can't stat
        }
      }
    }
  } catch (error) {
    logWarn(`Failed to calculate flagged disk usage`, { error })
  }
  
  try {
    if (existsSync(learningPath)) {
      const stats = statSync(learningPath)
      learningSize = stats.size
    }
  } catch (error) {
    logWarn(`Failed to get learning.json size`, { error })
  }
  
  return {
    drafts: { count: draftsCount, totalSize: draftsSize },
    flagged: { count: flaggedCount, totalSize: flaggedSize },
    learning: { size: learningSize }
  }
}

export function performDiskCleanup(options: CleanupOptions = {}): {
  drafts: { deleted: number; archived: number; errors: number }
  flagged: { deleted: number; archived: number; errors: number }
  diskUsage: ReturnType<typeof getDiskUsage>
} {
  logWithTime('[Disk Management] Starting disk cleanup...')
  
  const diskUsage = getDiskUsage()
  logInfo(`[Disk Management] Current disk usage:`, {
    drafts: `${diskUsage.drafts.count} files, ${(diskUsage.drafts.totalSize / 1024 / 1024).toFixed(2)} MB`,
    flagged: `${diskUsage.flagged.count} files, ${(diskUsage.flagged.totalSize / 1024 / 1024).toFixed(2)} MB`,
    learning: `${(diskUsage.learning.size / 1024).toFixed(2)} KB`
  })
  
  const draftsResult = cleanupDrafts(options)
  const flaggedResult = cleanupFlagged(options)
  
  const finalDiskUsage = getDiskUsage()
  logInfo(`[Disk Management] Disk usage after cleanup:`, {
    drafts: `${finalDiskUsage.drafts.count} files, ${(finalDiskUsage.drafts.totalSize / 1024 / 1024).toFixed(2)} MB`,
    flagged: `${finalDiskUsage.flagged.count} files, ${(finalDiskUsage.flagged.totalSize / 1024 / 1024).toFixed(2)} MB`,
    learning: `${(finalDiskUsage.learning.size / 1024).toFixed(2)} KB`
  })
  
  logWithTime('[Disk Management] Disk cleanup complete')
  
  return {
    drafts: draftsResult,
    flagged: flaggedResult,
    diskUsage: finalDiskUsage
  }
}

