import { copyFileSync, existsSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import simpleGit from 'simple-git'
import { createSlug } from '../utils/slug.js'

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
  
  console.log(`[Publisher] Copied to ${targetPath}`)
  
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
  
  console.log(`[Publisher] Opened PR: branch ${branchName}`)
  console.log(`[Publisher] PR URL: https://github.com/${contentRepo}/compare/${branchName}`)
}

