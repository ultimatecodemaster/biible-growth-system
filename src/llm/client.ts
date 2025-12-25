import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { trackAPIUsage } from '../utils/api-quota-monitor.js'

interface ModelConfig {
  providers: {
    openai: { model: string }
    ollama: { model: string; baseUrl: string }
  }
  routing: Record<string, 'openai' | 'ollama'>
}

let modelConfig: ModelConfig | null = null

function loadModelConfig(): ModelConfig {
  if (modelConfig) return modelConfig
  
  const configPath = join(process.cwd(), 'config', 'models.json')
  const configContent = readFileSync(configPath, 'utf-8')
  modelConfig = JSON.parse(configContent) as ModelConfig
  return modelConfig
}

export async function callLLM(
  role: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const config = loadModelConfig()
  const cloudMode = process.env.CLOUD_MODE === 'true'
  const provider = cloudMode ? 'openai' : config.routing[role] || 'openai'

  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [LLM] Calling ${provider} for role: ${role}`)

  if (provider === 'openai') {
    return callOpenAI(prompt, systemPrompt, role)
  } else {
    return callOllama(prompt, systemPrompt, role)
  }
}

async function callOpenAI(prompt: string, systemPrompt?: string, role?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const openai = new OpenAI({ apiKey })
  const config = loadModelConfig()
  const model = config.providers.openai.model

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  
  messages.push({ role: 'user', content: prompt })

  const callStart = Date.now()
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [LLM] Sending request to OpenAI (${model}) for role: ${role || 'unknown'}`)

  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7
    })

    const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
    const responseTimestamp = new Date().toISOString()
    
    // Track API usage for cost monitoring
    const usage = response.usage
    if (usage) {
      const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
      trackAPIUsage(totalTokens)
      console.log(`[${responseTimestamp}] [LLM] Received response from OpenAI (${callDuration}s) - Tokens: ${usage.prompt_tokens || 0} input + ${usage.completion_tokens || 0} output = ${totalTokens} total`)
    } else {
      console.log(`[${responseTimestamp}] [LLM] Received response from OpenAI (${callDuration}s)`)
    }

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    return content
  } catch (error: any) {
    const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
    const errorTimestamp = new Date().toISOString()
    console.log(`[${errorTimestamp}] [LLM] OpenAI call failed after ${callDuration}s`)
    
    if (error?.status === 429) {
      if (error?.code === 'insufficient_quota') {
        console.error('\n❌ OpenAI Quota Error:')
        console.error('Your API key has exceeded its quota or has no available credits.')
        console.error('Please check:')
        console.error('  1. https://platform.openai.com/account/billing - Add payment method or credits')
        console.error('  2. https://platform.openai.com/api-keys - Verify this key is active')
        console.error('  3. Make sure you\'re checking the correct OpenAI account')
        console.error('\nIf you just added credits, wait a few minutes for the system to update.')
        throw new Error('OpenAI quota exceeded. Please add credits or check your billing settings.')
      } else if (error?.code === 'rate_limit_exceeded') {
        console.error('\n⚠️  OpenAI Rate Limit:')
        console.error('Too many requests. Waiting 60 seconds before retry...')
        await new Promise(resolve => setTimeout(resolve, 60000))
        // Retry once
        const retryTimestamp = new Date().toISOString()
        console.log(`[${retryTimestamp}] [LLM] Retrying OpenAI request...`)
        const response = await openai.chat.completions.create({
          model,
          messages,
          temperature: 0.7
        })
        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error('OpenAI returned empty response')
        }
        return content
      }
    }
    throw error
  }
}

async function callOllama(prompt: string, systemPrompt?: string, role?: string): Promise<string> {
  const config = loadModelConfig()
  const baseUrl = process.env.OLLAMA_BASE_URL || config.providers.ollama.baseUrl
  const model = config.providers.ollama.model

  const fullPrompt = systemPrompt 
    ? `${systemPrompt}\n\n${prompt}`
    : prompt

  const callStart = Date.now()
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [LLM] Sending request to Ollama (${model}) for role: ${role || 'unknown'}`)

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      stream: false
    })
  })

  const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
  const responseTimestamp = new Date().toISOString()

  if (!response.ok) {
    console.log(`[${responseTimestamp}] [LLM] Ollama call failed after ${callDuration}s`)
    throw new Error(`Ollama API error: ${response.statusText}`)
  }

  console.log(`[${responseTimestamp}] [LLM] Received response from Ollama (${callDuration}s)`)
  const data = await response.json() as { response?: string }
  return data.response || ''
}

