import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { ensureDirSync } from 'fs-extra'
import { logWithTime, logInfo, logWarn } from './logger.js'
import type { LearningData } from './self-improvement.js'

const LEARNING_DATA_PATH = join(process.cwd(), 'data', 'learning.json')
const ARTIFACT_PATH = join(process.cwd(), 'learning-data.json')

/**
 * Check if running in GitHub Actions
 */
function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true'
}

/**
 * Load learning data from artifact or local file
 */
export function loadLearningDataFromArtifact(): LearningData | null {
  if (!isGitHubActions()) {
    logInfo('[Learning Persistence] Not in GitHub Actions, skipping artifact load')
    return null
  }
  
  // In GitHub Actions, look for learning-data.json in the root (downloaded artifact)
  const artifactPath = join(process.cwd(), 'learning-data.json')
  
  if (existsSync(artifactPath)) {
    try {
      const content = readFileSync(artifactPath, 'utf-8')
      const data = JSON.parse(content) as LearningData
      logInfo('[Learning Persistence] Loaded learning data from artifact', {
        errorPatterns: Object.keys(data.errorPatterns).length,
        agentHealth: Object.keys(data.agentHealth).length,
        improvements: data.improvements.length
      })
      
      // Copy to data directory for use during run
      ensureDirSync(join(process.cwd(), 'data'))
      writeFileSync(LEARNING_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
      logInfo('[Learning Persistence] Copied artifact data to data/learning.json')
      
      return data
    } catch (error) {
      logWarn('[Learning Persistence] Failed to load learning data from artifact', { error })
      return null
    }
  } else {
    logInfo('[Learning Persistence] No artifact found, starting fresh')
    return null
  }
}

/**
 * Save learning data as artifact for next run
 */
export function saveLearningDataAsArtifact(): void {
  if (!isGitHubActions()) {
    logInfo('[Learning Persistence] Not in GitHub Actions, skipping artifact save')
    return
  }
  
  if (!existsSync(LEARNING_DATA_PATH)) {
    logInfo('[Learning Persistence] No learning data to save')
    return
  }
  
  try {
    // Copy learning.json to root as learning-data.json for artifact upload
    copyFileSync(LEARNING_DATA_PATH, ARTIFACT_PATH)
    logInfo('[Learning Persistence] Saved learning data as artifact', {
      path: ARTIFACT_PATH
    })
  } catch (error) {
    logWarn('[Learning Persistence] Failed to save learning data as artifact', { error })
  }
}

/**
 * Initialize learning data persistence
 * Call this at the start of the application
 */
export function initializeLearningPersistence(): void {
  if (isGitHubActions()) {
    logWithTime('[Learning Persistence] Initializing learning data persistence for GitHub Actions')
    const loaded = loadLearningDataFromArtifact()
    if (loaded) {
      logInfo('[Learning Persistence] Successfully loaded previous learning data')
    } else {
      logInfo('[Learning Persistence] Starting with fresh learning data')
    }
  } else {
    logInfo('[Learning Persistence] Running locally, using local learning.json file')
  }
}

/**
 * Finalize learning data persistence
 * Call this at the end of the application (before exit)
 */
export function finalizeLearningPersistence(): void {
  if (isGitHubActions()) {
    logWithTime('[Learning Persistence] Saving learning data as artifact for next run')
    saveLearningDataAsArtifact()
  }
}

