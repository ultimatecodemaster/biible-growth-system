import { readFileSync } from 'fs'
import { join } from 'path'

export function loadPrompt(role: string): string {
  const promptPath = join(process.cwd(), 'prompts', `${role}.md`)
  try {
    return readFileSync(promptPath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to load prompt for role ${role}: ${error}`)
  }
}

export function formatPrompt(template: string, variables: Record<string, string>): string {
  let formatted = template
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return formatted
}

