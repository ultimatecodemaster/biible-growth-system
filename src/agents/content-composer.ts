import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { urlEncodeQuery } from '../utils/url-encode.js'
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
  
  const dataDir = join(process.cwd(), 'data', 'drafts')
  ensureDirSync(dataDir)
  
  const draftPath = join(dataDir, `${slug}.mdx`)
  writeFileSync(draftPath, response, 'utf-8')
  
  console.log(`[Content Composer] Saved draft to ${draftPath}`)
  
  return response
}

