import { callLLM } from '../llm/client.js'
import { loadPrompt } from '../llm/prompts.js'

export async function runFormatter(mdxContent: string): Promise<string> {
  console.log('[Formatter] Formatting MDX content...')
  
  const prompt = loadPrompt('formatter')
  const fullPrompt = `${prompt}\n\nMDX Content to format:\n\n${mdxContent}`
  
  const response = await callLLM('formatter', fullPrompt)
  
  console.log('[Formatter] Formatting complete')
  
  return response
}

