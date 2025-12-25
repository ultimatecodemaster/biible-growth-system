#!/usr/bin/env node
// Manual script to publish a single draft file
// Run with: npx tsx manual-publish.js <slug>
// Or: npm run publish:manual <slug>

import 'dotenv/config'
import { runPublisher } from './src/agents/publisher.js'

const slug = process.argv[2]

if (!slug) {
  console.log('Usage: node manual-publish.js <slug>')
  console.log('Example: node manual-publish.js how-can-i-develop-patience')
  console.log('')
  console.log('Available drafts:')
  const { readdirSync } = await import('fs')
  const { join } = await import('path')
  const drafts = readdirSync(join(process.cwd(), 'data', 'drafts'))
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace('.mdx', ''))
    .slice(0, 10)
  drafts.forEach(d => console.log(`  - ${d}`))
  process.exit(1)
}

const query = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

console.log('🚀 Manually publishing:', query)
console.log('Slug:', slug)
console.log('')

if (!process.env.GH_TOKEN || !process.env.CONTENT_REPO) {
  console.error('❌ GH_TOKEN or CONTENT_REPO not set in .env')
  process.exit(1)
}

try {
  await runPublisher(query, slug, process.env.CONTENT_REPO, process.env.GH_TOKEN)
  console.log('')
  console.log('✅ Published successfully!')
  console.log('Check GitHub for the PR:')
  console.log(`https://github.com/${process.env.CONTENT_REPO}/pulls`)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error)
  process.exit(1)
}

