import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { callLLM } from '../llm/client.js'
import { loadPrompt } from '../llm/prompts.js'

export async function runInterlinker(mdxContent: string): Promise<string> {
  console.log('[Interlinker] Enhancing internal links...')
  
  const existingQuestions: string[] = []
  const draftsDir = join(process.cwd(), 'data', 'drafts')
  
  if (existsSync(draftsDir)) {
    const files = readdirSync(draftsDir).filter(f => f.endsWith('.mdx'))
    for (const file of files) {
      const content = readFileSync(join(draftsDir, file), 'utf-8')
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) {
        existingQuestions.push(h1Match[1])
      }
    }
  }
  
  const prompt = loadPrompt('interlinker')
  const existingQuestionsList = existingQuestions.join('\n')
  const fullPrompt = `${prompt}\n\nExisting questions:\n${existingQuestionsList}\n\nMDX Content to enhance:\n\n${mdxContent}`
  
  const response = await callLLM('interlinker', fullPrompt)
  
  console.log('[Interlinker] Link enhancement complete')
  
  return response
}

