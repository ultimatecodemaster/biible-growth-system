import { copyFileSync, existsSync, readFileSync, statSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import simpleGit from 'simple-git'
import { createSlug } from '../utils/slug.js'
import { containsPersonalInfo } from '../utils/personal-info-sanitizer.js'

export async function runPublisher(
  query: string,
  slug: string,
  contentRepo?: string,
  ghToken?: string
): Promise<void> {
  console.log(`[Publisher] Publishing: ${query}`)
  
  if (!contentRepo || !ghToken) {
    console.warn('[Publisher] GH_TOKEN or CONTENT_REPO not set. Skipping PR creation.')
    console.log('[Publisher] Content would be published to:', contentRepo)
    return
  }
  
  const draftPath = join(process.cwd(), 'data', 'drafts', `${slug}.mdx`)
  if (!existsSync(draftPath)) {
    throw new Error(`Draft file not found: ${draftPath}`)
  }

  // Validate content before creating PR
  const validationResult = validateContent(draftPath, query)
  if (!validationResult.valid) {
    console.warn(`[Publisher] Content validation failed: ${validationResult.reason}`)
    console.log(`[Publisher] Skipping PR creation for "${query}" - ${validationResult.reason}`)
    return
  }
  
  // In CI, content repo might be in a different location
  // Check multiple possible paths
  let contentRepoPath = join(process.cwd(), '..', 'biible-content-site')
  if (!existsSync(contentRepoPath)) {
    // Try CI path (content-site from workflow)
    contentRepoPath = join(process.cwd(), '..', 'content-site')
  }
  if (!existsSync(contentRepoPath)) {
    // Try current directory (if running from content repo)
    contentRepoPath = process.cwd()
    if (!existsSync(join(contentRepoPath, 'src', 'content', 'questions'))) {
      console.warn(`[Publisher] Content repo not found. Tried: ${join(process.cwd(), '..', 'biible-content-site')}, ${join(process.cwd(), '..', 'content-site')}`)
      return
    }
  }
  
  const targetDir = join(contentRepoPath, 'src', 'content', 'questions')
  ensureDirSync(targetDir)
  
  const targetPath = join(targetDir, `${slug}.mdx`)
  copyFileSync(draftPath, targetPath)
  
  console.log(`[Publisher] Copied MDX to ${targetPath}`)
  
  // Also copy structured data JSON if it exists
  const structuredDataPath = join(process.cwd(), 'data', 'drafts', `${slug}.structured-data.json`)
  if (existsSync(structuredDataPath)) {
    const structuredDataTargetDir = join(contentRepoPath, 'src', 'content', 'structured-data')
    ensureDirSync(structuredDataTargetDir)
    const structuredDataTargetPath = join(structuredDataTargetDir, `${slug}.json`)
    copyFileSync(structuredDataPath, structuredDataTargetPath)
    console.log(`[Publisher] Copied structured data to ${structuredDataTargetPath}`)
  }
  
  const git = simpleGit(contentRepoPath)
  const timestamp = Date.now()
  const branchName = `ags/${timestamp}`
  
  // Configure git for CI environment
  await git.addConfig('user.name', 'github-actions[bot]', false, 'local').catch(() => {})
  await git.addConfig('user.email', 'github-actions[bot]@users.noreply.github.com', false, 'local').catch(() => {})
  
  try {
    // Try to get current branch or default to main
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main')
    if (currentBranch !== 'main' && currentBranch !== 'master') {
      await git.checkout('main').catch(() => git.checkout('master'))
    }
    await git.pull('origin', 'main').catch(() => git.pull('origin', 'master').catch(() => {}))
  } catch (error) {
    console.warn('[Publisher] Could not checkout/pull main/master, continuing...', error)
  }
  
  await git.checkoutLocalBranch(branchName)
  await git.add(targetPath)
  await git.commit(`AGS: Add ${query}`)
  
  const remoteUrl = `https://${ghToken}@github.com/${contentRepo}.git`
  try {
    await git.remote(['set-url', 'origin', remoteUrl])
  } catch {
    await git.addRemote('origin', remoteUrl)
  }
  
  await git.push(['-u', 'origin', branchName])
  
  // Create PR using GitHub API
  const [owner, repo] = contentRepo.split('/')
  const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `AGS: Add ${query}`,
      head: branchName,
      base: 'main',
      body: `Automated content generation for: ${query}\n\nThis PR was created by the Biible Autonomous Growth System.`
    })
  })
  
  if (prResponse.ok) {
    const prData = await prResponse.json()
    console.log(`[Publisher] ✅ PR created successfully!`)
    console.log(`[Publisher] PR #${prData.number}: ${prData.html_url}`)
    console.log(`[Publisher] PR URL: ${prData.html_url}`)
  } else {
    const errorData = await prResponse.json().catch(() => ({ message: 'Unknown error' }))
    console.warn(`[Publisher] ⚠️  Could not create PR via API: ${errorData.message}`)
    console.log(`[Publisher] Branch pushed: ${branchName}`)
    console.log(`[Publisher] Create PR manually: https://github.com/${contentRepo}/compare/${branchName}`)
  }
}

/**
 * Validates MDX content before publishing to prevent blank deployments
 * Checks file size, frontmatter presence, and actual content
 */
function validateContent(filePath: string, query: string): { valid: boolean; reason?: string } {
  try {
    // Check file size (minimum 100 bytes to ensure it's not empty)
    const stats = statSync(filePath)
    if (stats.size < 100) {
      return {
        valid: false,
        reason: `File too small (${stats.size} bytes). Minimum 100 bytes required.`
      }
    }

    // Read file content
    const fileContent = readFileSync(filePath, 'utf-8')
    const trimmedContent = fileContent.trim()

    // Check if file is empty
    if (trimmedContent.length === 0) {
      return {
        valid: false,
        reason: 'File is empty'
      }
    }

    // Check for frontmatter (must start with ---)
    if (!trimmedContent.startsWith('---')) {
      return {
        valid: false,
        reason: 'Missing frontmatter (file must start with ---)'
      }
    }

    // Extract frontmatter
    const frontmatterEnd = trimmedContent.indexOf('---', 3)
    if (frontmatterEnd === -1) {
      return {
        valid: false,
        reason: 'Invalid frontmatter (missing closing ---)'
      }
    }

    const frontmatter = trimmedContent.substring(0, frontmatterEnd + 3)
    const contentAfterFrontmatter = trimmedContent.substring(frontmatterEnd + 3).trim()

    // Check that there's actual content after frontmatter
    if (contentAfterFrontmatter.length < 50) {
      return {
        valid: false,
        reason: `Insufficient content after frontmatter (${contentAfterFrontmatter.length} chars). Minimum 50 characters required.`
      }
    }

    // Check for required frontmatter fields
    const requiredFields = ['title', 'metaTitle', 'metaDescription', 'canonicalUrl']
    for (const field of requiredFields) {
      if (!frontmatter.includes(`${field}:`)) {
        return {
          valid: false,
          reason: `Missing required frontmatter field: ${field}`
        }
      }
    }

    // Check that content has at least one heading (H1 or H2)
    if (!contentAfterFrontmatter.match(/^#+\s+/m)) {
      return {
        valid: false,
        reason: 'Content missing required heading (H1 or H2)'
      }
    }

    // CRITICAL: Check for personal information in entire content (frontmatter + body)
    console.log(`[Publisher] Validating content for personal information...`)
    if (containsPersonalInfo(fileContent)) {
      return {
        valid: false,
        reason: 'Content contains personal information (names, file paths, etc.) - BLOCKED for security'
      }
    }
    console.log(`[Publisher] Personal information check passed`)

    // All validations passed
    console.log(`[Publisher] Content validation passed for "${query}" (${stats.size} bytes, ${contentAfterFrontmatter.length} chars content)`)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

