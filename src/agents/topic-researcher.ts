import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt } from '../llm/prompts.js'
import { TopicRowSchema, type TopicRow } from '../schemas.js'

export async function runTopicResearcher(): Promise<TopicRow[]> {
  console.log('[Topic Researcher] Starting...')
  
  const prompt = loadPrompt('topic_researcher')
  const response = await callLLM('topic_researcher', prompt)
  
  console.log('[Topic Researcher] Received response, parsing CSV...')
  
  const lines = response.trim().split('\n').filter(line => line.trim())
  const topics: TopicRow[] = []
  
  for (const line of lines) {
    if (line.startsWith('query,cluster,risk')) continue
    
    const [query, cluster, risk] = line.split(',').map(s => s.trim())
    if (!query || !cluster || !risk) continue
    
    try {
      const topic = TopicRowSchema.parse({ query, cluster, risk })
      topics.push(topic)
    } catch (error) {
      console.warn(`[Topic Researcher] Skipping invalid row: ${line}`, error)
    }
  }
  
  console.log(`[Topic Researcher] Generated ${topics.length} topics`)
  
  const dataDir = join(process.cwd(), 'data')
  ensureDirSync(dataDir)
  
  const csvPath = join(dataDir, 'topics.csv')
  const csvHeader = 'query,cluster,risk\n'
  const csvRows = topics.map(t => `${t.query},${t.cluster},${t.risk}`).join('\n')
  writeFileSync(csvPath, csvHeader + csvRows, 'utf-8')
  
  console.log(`[Topic Researcher] Saved to ${csvPath}`)
  
  return topics
}

