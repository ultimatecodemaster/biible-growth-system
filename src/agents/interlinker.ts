import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt } from '../llm/prompts.js'
import { createSlug } from '../utils/slug.js'
import { containsPersonalInfo } from '../utils/personal-info-sanitizer.js'

interface ExistingQuestion {
  question: string
  slug: string
}

export async function runInterlinker(mdxContent: string): Promise<string> {
  console.log('[Interlinker] Enhancing internal links...')
  
  const existingQuestions: ExistingQuestion[] = []
  
  // Check drafts directory
  const draftsDir = join(process.cwd(), 'data', 'drafts')
  if (existsSync(draftsDir)) {
    const files = readdirSync(draftsDir).filter(f => f.endsWith('.mdx'))
    for (const file of files) {
      const content = readFileSync(join(draftsDir, file), 'utf-8')
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        const question = h1Match[1]
        const slug = file.replace('.mdx', '')
        existingQuestions.push({ question, slug })
      }
    }
  }
  
  // Check published content site directory (if available)
  const contentSiteDir = join(process.cwd(), '..', 'biible-content-site', 'src', 'content', 'questions')
  if (existsSync(contentSiteDir)) {
    const files = readdirSync(contentSiteDir).filter(f => f.endsWith('.mdx'))
    for (const file of files) {
      const content = readFileSync(join(contentSiteDir, file), 'utf-8')
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        const question = h1Match[1]
        const slug = file.replace('.mdx', '')
        // Only add if not already in list (avoid duplicates)
        if (!existingQuestions.find(q => q.slug === slug)) {
          existingQuestions.push({ question, slug })
        }
      }
    }
  }
  
  // Format existing questions with slugs for the prompt
  const existingQuestionsList = existingQuestions
    .map(q => `- "${q.question}" (slug: ${q.slug})`)
    .join('\n')
  
  const prompt = loadPrompt('interlinker')
  const fullPrompt = `${prompt}\n\nExisting questions (use internal links for these):\n${existingQuestionsList}\n\nMDX Content to enhance:\n\n${mdxContent}`
  
  const response = await callLLM('interlinker', fullPrompt)
  
  console.log(`[Interlinker] Link enhancement complete (found ${existingQuestions.length} existing questions)`)
  
  // Validate enhanced content for personal information in URLs
  console.log(`[Interlinker] Validating enhanced content for personal information in URLs...`)
  if (containsPersonalInfo(response)) {
    console.error(`[Interlinker] ERROR: Enhanced content contains personal information in URLs`)
    console.error(`[Interlinker] Content preview: ${response.substring(0, 500)}...`)
    throw new Error('Enhanced content contains personal information in URLs. This is not allowed.')
  }
  console.log(`[Interlinker] Enhanced content validated - no personal information detected in URLs`)
  
  return response
}

