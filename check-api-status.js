#!/usr/bin/env node
/**
 * Diagnostic script to check OpenAI API key status
 */
import 'dotenv/config'
import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in .env file')
  process.exit(1)
}

console.log('🔍 Checking OpenAI API Key Status...\n')
console.log(`Key prefix: ${apiKey.substring(0, 20)}...`)
console.log(`Key length: ${apiKey.length} characters`)
console.log(`Key type: ${apiKey.startsWith('sk-proj-') ? 'Project key' : 'Account key'}\n`)

const openai = new OpenAI({ apiKey })

// Try to get account info (if API supports it)
async function checkStatus() {
  try {
    // Try a minimal call first
    console.log('Testing with minimal API call...')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    })
    
    console.log('✅ API is working!')
    console.log('Response received:', response.choices[0]?.message?.content)
    console.log('Usage:', response.usage)
    
  } catch (error) {
    console.log('❌ API Error:')
    console.log(`   Status: ${error.status}`)
    console.log(`   Code: ${error.code}`)
    console.log(`   Type: ${error.type}`)
    console.log(`   Message: ${error.message}\n`)
    
    if (error.status === 401) {
      console.log('🔑 This is an authentication error.')
      console.log('   → Your API key might be invalid or revoked')
      console.log('   → Check: https://platform.openai.com/api-keys')
      console.log('   → Try creating a new API key')
    } else if (error.status === 429) {
      if (error.code === 'insufficient_quota') {
        console.log('💰 This is a QUOTA error.')
        console.log('   → Your account/project has no available credits')
        console.log('   → Even if dashboard shows quota, API says none available')
        console.log('\n   Steps to fix:')
        console.log('   1. Go to: https://platform.openai.com/account/billing')
        console.log('   2. Add a payment method (if not already added)')
        console.log('   3. Check for spending limits that might be blocking usage')
        console.log('   4. If using projects, check project limits: https://platform.openai.com/org/projects')
        console.log('   5. Wait 5-10 minutes after adding credits (can take time to propagate)')
      } else if (error.code === 'rate_limit_exceeded') {
        console.log('⏱️  This is a RATE LIMIT error.')
        console.log('   → Too many requests too quickly')
        console.log('   → Wait 60 seconds and try again')
      }
    }
    
    process.exit(1)
  }
}

checkStatus()

