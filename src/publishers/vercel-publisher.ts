import { copyFileSync, existsSync, readFileSync, statSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import simpleGit from 'simple-git'
import { BasePublisher, type PublishContent, type PublishResult } from './base-publisher.js'

export class VercelPublisher extends BasePublisher {
  private contentRepo?: string
  private ghToken?: string

  constructor(targetId: string, config: Record<string, any>) {
    super(targetId, config)
    this.contentRepo = config.repo || process.env.CONTENT_REPO
    this.ghToken = config.ghToken || process.env.GH_TOKEN
  }

  async publish(content: PublishContent): Promise<PublishResult> {
    this.log(`Publishing: ${content.query}`)
    
    if (!this.contentRepo || !this.ghToken) {
      const errorMsg = 'GH_TOKEN or CONTENT_REPO not set. Skipping PR creation.'
      this.error(errorMsg)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    const draftPath = join(process.cwd(), 'data', 'drafts', `${content.slug}.mdx`)
    if (!existsSync(draftPath)) {
      const errorMsg = `Draft file not found: ${draftPath}`
      this.error(errorMsg)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    // Validate content before creating PR
    const validationResult = this.validateContent(draftPath, content.query)
    if (!validationResult.valid) {
      const errorMsg = `Content validation failed: ${validationResult.reason}`
      this.error(errorMsg)
      this.log(`Skipping PR creation for "${content.query}" - ${validationResult.reason}`)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    // In CI, content repo might be in a different location
    // Check multiple possible paths
    let contentRepoPath = this.config.path || join(process.cwd(), '..', 'biible-content-site')
    if (!existsSync(contentRepoPath)) {
      // Try CI path (content-site from workflow)
      contentRepoPath = join(process.cwd(), '..', 'content-site')
    }
    if (!existsSync(contentRepoPath)) {
      // Try current directory (if running from content repo)
      contentRepoPath = process.cwd()
      if (!existsSync(join(contentRepoPath, 'src', 'content', 'questions'))) {
        const errorMsg = `Content repo not found. Tried: ${join(process.cwd(), '..', 'biible-content-site')}, ${join(process.cwd(), '..', 'content-site')}`
        this.error(errorMsg)
        return {
          success: false,
          platform: 'vercel',
          error: errorMsg
        }
      }
    }

    const targetDir = join(contentRepoPath, 'src', 'content', 'questions')
    ensureDirSync(targetDir)

    const targetPath = join(targetDir, `${content.slug}.mdx`)
    copyFileSync(draftPath, targetPath)

    this.log(`Copied MDX to ${targetPath}`)

    // Also copy structured data JSON if it exists
    const structuredDataPath = join(process.cwd(), 'data', 'drafts', `${content.slug}.structured-data.json`)
    if (existsSync(structuredDataPath)) {
      const structuredDataTargetDir = join(contentRepoPath, 'src', 'content', 'structured-data')
      ensureDirSync(structuredDataTargetDir)
      const structuredDataTargetPath = join(structuredDataTargetDir, `${content.slug}.json`)
      copyFileSync(structuredDataPath, structuredDataTargetPath)
      this.log(`Copied structured data to ${structuredDataTargetPath}`)
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
      this.log(`Could not checkout/pull main/master, continuing...`)
    }

    await git.checkoutLocalBranch(branchName)
    await git.add(targetPath)
    await git.commit(`AGS: Add ${content.query}`)

    const remoteUrl = `https://${this.ghToken}@github.com/${this.contentRepo}.git`
    try {
      await git.remote(['set-url', 'origin', remoteUrl])
    } catch {
      await git.addRemote('origin', remoteUrl)
    }

    await git.push(['-u', 'origin', branchName])

    const prUrl = `https://github.com/${this.contentRepo}/compare/${branchName}`
    this.log(`Opened PR: branch ${branchName}`)
    this.log(`PR URL: ${prUrl}`)

    return {
      success: true,
      platform: 'vercel',
      url: prUrl,
      metadata: {
        branch: branchName,
        repo: this.contentRepo
      }
    }
  }

  /**
   * Validates MDX content before publishing to prevent blank deployments
   * Checks file size, frontmatter presence, and actual content
   */
  private validateContent(filePath: string, query: string): { valid: boolean; reason?: string } {
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

      // All validations passed
      this.log(`Content validation passed for "${query}" (${stats.size} bytes, ${contentAfterFrontmatter.length} chars content)`)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

