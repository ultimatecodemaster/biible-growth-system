import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { SafetyReviewSchema } from '../schemas.js'
import type { VerseMap } from '../schemas.js'

export async function runSafetyOfficer(
  query: string,
  verseMap: VerseMap,
  mdxContent: string,
  slug: string
): Promise<{ approved: boolean; reason?: string }> {
  console.log(`[Safety Officer] Reviewing: ${query}`)
  
  const promptTemplate = loadPrompt('safety_officer')
  const verseMapJson = JSON.stringify(verseMap, null, 2)
  const prompt = `${formatPrompt(promptTemplate, { query })}\n\nVerse Map:\n${verseMapJson}\n\nMDX Content:\n${mdxContent}`
  
  const response = await callLLM('safety_officer', prompt)
  
  console.log(`[Safety Officer] Review complete for: ${query}`)
  
  let review
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const jsonStr = jsonMatch[0]
    const parsed = JSON.parse(jsonStr)
    review = SafetyReviewSchema.parse(parsed)
  } catch (error) {
    console.error(`[Safety Officer] Failed to parse response`, error)
    review = { approved: false, reason: 'Failed to parse safety review response' }
  }
  
  if (!review.approved) {
    const flaggedDir = join(process.cwd(), 'data', 'flagged')
    ensureDirSync(flaggedDir)
    
    const flaggedPath = join(flaggedDir, `${slug}.json`)
    writeFileSync(
      flaggedPath,
      JSON.stringify(
        {
          query,
          slug,
          reason: review.reason || 'Unknown reason',
          verseMap,
          mdxContent
        },
        null,
        2
      ),
      'utf-8'
    )
    
    console.log(`[Safety Officer] Content VETOED. Saved to ${flaggedPath}`)
  } else {
    console.log(`[Safety Officer] Content APPROVED`)
  }
  
  return review
}

