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
    this.log(`[VercelPublisher] Starting publish for: ${content.query}`)
    this.log(`[VercelPublisher] Slug: ${content.slug}`)
    
    if (!this.contentRepo || !this.ghToken) {
      const errorMsg = 'GH_TOKEN or CONTENT_REPO not set. Skipping PR creation.'
      this.error(`[VercelPublisher] ${errorMsg}`)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    this.log(`[VercelPublisher] Content repo: ${this.contentRepo}`)

    const draftPath = join(process.cwd(), 'data', 'drafts', `${content.slug}.mdx`)
    this.log(`[VercelPublisher] Checking draft file: ${draftPath}`)
    
    if (!existsSync(draftPath)) {
      const errorMsg = `Draft file not found: ${draftPath}`
      this.error(`[VercelPublisher] ${errorMsg}`)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    // Validate content before creating PR - this is critical to prevent blank deployments
    this.log(`[VercelPublisher] Validating content before publishing...`)
    const validationResult = this.validateContent(draftPath, content.query)
    if (!validationResult.valid) {
      const errorMsg = `Content validation failed: ${validationResult.reason}`
      this.error(`[VercelPublisher] VALIDATION FAILED: ${errorMsg}`)
      this.error(`[VercelPublisher] Skipping PR creation for "${content.query}" to prevent blank deployment`)
      return {
        success: false,
        platform: 'vercel',
        error: errorMsg
      }
    }

    this.log(`[VercelPublisher] Content validation passed - proceeding with PR creation`)

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

    this.log(`[VercelPublisher] ✅ Copied MDX to ${targetPath}`)

    // Also copy structured data JSON if it exists
    const structuredDataPath = join(process.cwd(), 'data', 'drafts', `${content.slug}.structured-data.json`)
    if (existsSync(structuredDataPath)) {
      const structuredDataTargetDir = join(contentRepoPath, 'src', 'content', 'structured-data')
      ensureDirSync(structuredDataTargetDir)
      const structuredDataTargetPath = join(structuredDataTargetDir, `${content.slug}.json`)
      copyFileSync(structuredDataPath, structuredDataTargetPath)
      this.log(`[VercelPublisher] ✅ Copied structured data to ${structuredDataTargetPath}`)
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
    this.log(`[VercelPublisher] ✅ Successfully created PR branch: ${branchName}`)
    this.log(`[VercelPublisher] 📝 PR URL: ${prUrl}`)
    this.log(`[VercelPublisher] ⚠️  NOTE: Only merge PRs with valid content to prevent blank Vercel deployments!`)

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
   * This is critical - invalid content will create blank Vercel deployments
   */
  private validateContent(filePath: string, query: string): { valid: boolean; reason?: string } {
    try {
      this.log(`[Validation] Starting validation for: ${query}`)
      
      // Check file size (minimum 500 bytes to ensure substantial content)
      const stats = statSync(filePath)
      this.log(`[Validation] File size: ${stats.size} bytes`)
      
      if (stats.size < 500) {
        this.error(`[Validation] File too small: ${stats.size} bytes (minimum 500 required)`)
        return {
          valid: false,
          reason: `File too small (${stats.size} bytes). Minimum 500 bytes required to ensure substantial content.`
        }
      }

      // Read file content
      const fileContent = readFileSync(filePath, 'utf-8')
      const trimmedContent = fileContent.trim()

      // Check if file is empty
      if (trimmedContent.length === 0) {
        this.error(`[Validation] File is completely empty`)
        return {
          valid: false,
          reason: 'File is empty'
        }
      }

      // Check for frontmatter (must start with ---)
      if (!trimmedContent.startsWith('---')) {
        this.error(`[Validation] Missing frontmatter - file does not start with ---`)
        return {
          valid: false,
          reason: 'Missing frontmatter (file must start with ---)'
        }
      }

      // Extract frontmatter
      const frontmatterEnd = trimmedContent.indexOf('---', 3)
      if (frontmatterEnd === -1) {
        this.error(`[Validation] Invalid frontmatter - missing closing ---`)
        return {
          valid: false,
          reason: 'Invalid frontmatter (missing closing ---)'
        }
      }

      const frontmatter = trimmedContent.substring(0, frontmatterEnd + 3)
      const contentAfterFrontmatter = trimmedContent.substring(frontmatterEnd + 3).trim()

      this.log(`[Validation] Frontmatter length: ${frontmatter.length} chars`)
      this.log(`[Validation] Content after frontmatter: ${contentAfterFrontmatter.length} chars`)

      // Check that there's actual content after frontmatter (increased minimum)
      if (contentAfterFrontmatter.length < 200) {
        this.error(`[Validation] Insufficient content: ${contentAfterFrontmatter.length} chars (minimum 200 required)`)
        return {
          valid: false,
          reason: `Insufficient content after frontmatter (${contentAfterFrontmatter.length} chars). Minimum 200 characters required to ensure quality content.`
        }
      }

      // Check for required frontmatter fields
      const requiredFields = ['title', 'metaTitle', 'metaDescription', 'canonicalUrl']
      const missingFields: string[] = []
      
      for (const field of requiredFields) {
        if (!frontmatter.includes(`${field}:`)) {
          missingFields.push(field)
        }
      }

      if (missingFields.length > 0) {
        this.error(`[Validation] Missing required frontmatter fields: ${missingFields.join(', ')}`)
        return {
          valid: false,
          reason: `Missing required frontmatter fields: ${missingFields.join(', ')}`
        }
      }

      // Check that content has at least one heading (H1 or H2)
      if (!contentAfterFrontmatter.match(/^#+\s+/m)) {
        this.error(`[Validation] Content missing required heading (H1 or H2)`)
        return {
          valid: false,
          reason: 'Content missing required heading (H1 or H2)'
        }
      }

      // Check for at least one paragraph of actual content (not just headings)
      const paragraphs = contentAfterFrontmatter.split(/\n\s*\n/).filter(p => p.trim().length > 0 && !p.trim().startsWith('#'))
      if (paragraphs.length === 0) {
        this.error(`[Validation] Content has no paragraphs - only headings found`)
        return {
          valid: false,
          reason: 'Content must have at least one paragraph of text (not just headings)'
        }
      }

      // All validations passed
      this.log(`[Validation] ✅ All checks passed for "${query}"`)
      this.log(`[Validation] File: ${stats.size} bytes, Content: ${contentAfterFrontmatter.length} chars, Paragraphs: ${paragraphs.length}`)
      return { valid: true }
    } catch (error) {
      this.error(`[Validation] Error during validation: ${error instanceof Error ? error.message : String(error)}`)
      return {
        valid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

