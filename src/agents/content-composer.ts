import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { urlEncodeQuery } from '../utils/url-encode.js'
import { containsPersonalInfo } from '../utils/personal-info-sanitizer.js'
import type { VerseMap } from '../schemas.js'

export async function runContentComposer(
  query: string,
  verseMap: VerseMap,
  slug: string
): Promise<string> {
  console.log(`[Content Composer] Composing content for: ${query}`)
  
  const promptTemplate = loadPrompt('content_composer')
  const verseMapJson = JSON.stringify(verseMap, null, 2)
  const prompt = `${formatPrompt(promptTemplate, { query })}\n\nVerse Map Data:\n${verseMapJson}`
  
  const response = await callLLM('content_composer', prompt)
  
  console.log(`[Content Composer] Generated MDX for: ${query}`)
  
  // Validate content for personal information in URLs
  console.log(`[Content Composer] Validating content for personal information in URLs...`)
  if (containsPersonalInfo(response)) {
    console.error(`[Content Composer] ERROR: Generated content contains personal information in URLs`)
    console.error(`[Content Composer] Content preview: ${response.substring(0, 500)}...`)
    throw new Error('Generated content contains personal information in URLs. This is not allowed.')
  }
  console.log(`[Content Composer] Content validated - no personal information detected in URLs`)
  
  const dataDir = join(process.cwd(), 'data', 'drafts')
  ensureDirSync(dataDir)
  
  const draftPath = join(dataDir, `${slug}.mdx`)
  writeFileSync(draftPath, response, 'utf-8')
  
  console.log(`[Content Composer] Saved draft to ${draftPath}`)
  
  return response
}

