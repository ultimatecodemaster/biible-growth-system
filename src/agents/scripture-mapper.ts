import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt, formatPrompt } from '../llm/prompts.js'
import { VerseMapSchema } from '../schemas.js'
import { createSlug } from '../utils/slug.js'
import type { TopicRow } from '../schemas.js'

export async function runScriptureMapper(topic: TopicRow): Promise<{ slug: string; verseMap: any }> {
  console.log(`[Scripture Mapper] Processing: ${topic.query}`)
  
  const promptTemplate = loadPrompt('scripture_mapper')
  const prompt = formatPrompt(promptTemplate, { query: topic.query })
  
  const response = await callLLM('scripture_mapper', prompt)
  
  console.log(`[Scripture Mapper] Received response for: ${topic.query}`)
  
  let verseMap
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const jsonStr = jsonMatch[0]
    const parsed = JSON.parse(jsonStr)
    verseMap = VerseMapSchema.parse(parsed)
  } catch (error) {
    console.error(`[Scripture Mapper] Failed to parse response for: ${topic.query}`, error)
    throw error
  }
  
  const slug = createSlug(topic.query)
  const dataDir = join(process.cwd(), 'data', 'verse_maps')
  ensureDirSync(dataDir)
  
  const mapPath = join(dataDir, `${slug}.json`)
  writeFileSync(mapPath, JSON.stringify(verseMap, null, 2), 'utf-8')
  
  console.log(`[Scripture Mapper] Saved verse map to ${mapPath}`)
  
  return { slug, verseMap }
}

