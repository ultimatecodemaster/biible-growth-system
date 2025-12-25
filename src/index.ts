import 'dotenv/config'
import { runOrchestrator } from './orchestrator.js'

async function main() {
  console.log('Starting Biible Autonomous Growth System...')
  console.log(`CLOUD_MODE: ${process.env.CLOUD_MODE || 'false'}`)
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }
  
  await runOrchestrator()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

