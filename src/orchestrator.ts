import { writeFileSync } from 'fs'
import { join } from 'path'
import { runTopicResearcher } from './agents/topic-researcher.js'
import { runScriptureMapper } from './agents/scripture-mapper.js'
import { runContentComposer } from './agents/content-composer.js'
import { runFormatter } from './agents/formatter.js'
import { runInterlinker } from './agents/interlinker.js'
import { runSafetyOfficer } from './agents/safety-officer.js'
import { runPublisher } from './agents/publisher.js'
import type { TopicRow, VerseMap } from './schemas.js'

function getTimestamp(): string {
  return new Date().toISOString()
}

function logWithTime(message: string): void {
  console.log(`[${getTimestamp()}] ${message}`)
}

export async function runOrchestrator(): Promise<void> {
  logWithTime('='.repeat(60))
  logWithTime('Biible Autonomous Growth System - Starting')
  logWithTime('='.repeat(60))
  
  try {
    // Step 1: Topic Researcher
    logWithTime('\n[ORCHESTRATOR] Step 1/7: Topic Researcher - Starting...')
    const step1Start = Date.now()
    const topics = await runTopicResearcher()
    const step1Duration = ((Date.now() - step1Start) / 1000).toFixed(2)
    logWithTime(`[ORCHESTRATOR] Step 1/7: Topic Researcher - Complete (${step1Duration}s)`)
    logWithTime(`[ORCHESTRATOR] Generated ${topics.length} topics`)
    
    // Filter to only LOW-risk topics
    const lowRiskTopics = topics.filter(t => t.risk === 'low')
    logWithTime(`[ORCHESTRATOR] Processing ${lowRiskTopics.length} LOW-risk topics`)
    
    let approvedCount = 0
    let vetoedCount = 0
    
    // Process each topic through the pipeline
    for (const topic of lowRiskTopics) {
      logWithTime(`\n[ORCHESTRATOR] Processing topic: ${topic.query}`)
      const topicStart = Date.now()
      
      try {
        // Step 2: Scripture Mapper
        logWithTime(`[ORCHESTRATOR] Step 2/7: Scripture Mapper - Starting...`)
        const step2Start = Date.now()
        const { slug, verseMap } = await runScriptureMapper(topic)
        const step2Duration = ((Date.now() - step2Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 2/7: Scripture Mapper - Complete (${step2Duration}s)`)
        
        // Check if HIGH-risk after mapping
        if (verseMap.risk === 'high') {
          logWithTime(`[ORCHESTRATOR] Topic flagged as HIGH-risk after mapping. Skipping.`)
          vetoedCount++
          continue
        }
        
        // Step 3: Content Composer
        logWithTime(`[ORCHESTRATOR] Step 3/7: Content Composer - Starting...`)
        const step3Start = Date.now()
        let mdxContent = await runContentComposer(topic.query, verseMap, slug)
        const step3Duration = ((Date.now() - step3Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 3/7: Content Composer - Complete (${step3Duration}s)`)
        
        // Step 4: Formatter (optional)
        logWithTime(`[ORCHESTRATOR] Step 4/7: Formatter - Starting...`)
        const step4Start = Date.now()
        try {
          mdxContent = await runFormatter(mdxContent)
          const step4Duration = ((Date.now() - step4Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 4/7: Formatter - Complete (${step4Duration}s)`)
        } catch (error) {
          const step4Duration = ((Date.now() - step4Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 4/7: Formatter - Failed after ${step4Duration}s, continuing with original content`)
          console.warn(`[ORCHESTRATOR] Formatter error:`, error)
        }
        
        // Step 5: Interlinker (optional)
        logWithTime(`[ORCHESTRATOR] Step 5/7: Interlinker - Starting...`)
        const step5Start = Date.now()
        try {
          mdxContent = await runInterlinker(mdxContent)
          const step5Duration = ((Date.now() - step5Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 5/7: Interlinker - Complete (${step5Duration}s)`)
        } catch (error) {
          const step5Duration = ((Date.now() - step5Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 5/7: Interlinker - Failed after ${step5Duration}s, continuing with original content`)
          console.warn(`[ORCHESTRATOR] Interlinker error:`, error)
        }
        
        // Save updated MDX content back to draft
        const draftPath = join(process.cwd(), 'data', 'drafts', `${slug}.mdx`)
        writeFileSync(draftPath, mdxContent, 'utf-8')
        logWithTime(`[ORCHESTRATOR] Draft saved: ${slug}.mdx`)
        
        // Step 6: Safety Officer
        logWithTime(`[ORCHESTRATOR] Step 6/7: Safety Officer - Starting...`)
        const step6Start = Date.now()
        const safetyReview = await runSafetyOfficer(topic.query, verseMap, mdxContent, slug)
        const step6Duration = ((Date.now() - step6Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 6/7: Safety Officer - Complete (${step6Duration}s)`)
        
        if (!safetyReview.approved) {
          logWithTime(`[ORCHESTRATOR] Content vetoed by Safety Officer: ${safetyReview.reason}`)
          vetoedCount++
          continue
        }
        
        // Step 7: Publisher
        logWithTime(`[ORCHESTRATOR] Step 7/7: Publisher - Starting...`)
        const step7Start = Date.now()
        await runPublisher(
          topic.query,
          slug,
          process.env.CONTENT_REPO,
          process.env.GH_TOKEN
        )
        const step7Duration = ((Date.now() - step7Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 7/7: Publisher - Complete (${step7Duration}s)`)
        
        const topicDuration = ((Date.now() - topicStart) / 1000).toFixed(2)
        approvedCount++
        logWithTime(`[ORCHESTRATOR] ✓ Successfully processed: ${topic.query} (Total: ${topicDuration}s)`)
        
      } catch (error) {
        const topicDuration = ((Date.now() - topicStart) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Error processing topic "${topic.query}" after ${topicDuration}s:`)
        console.error(`[ORCHESTRATOR] Error details:`, error)
        vetoedCount++
      }
    }
    
    logWithTime('\n' + '='.repeat(60))
    logWithTime('Biible Autonomous Growth System - Complete')
    logWithTime('='.repeat(60))
    logWithTime(`Approved: ${approvedCount}`)
    logWithTime(`Vetoed/Skipped: ${vetoedCount}`)
    logWithTime(`Total: ${lowRiskTopics.length}`)
    
  } catch (error) {
    logWithTime('[ORCHESTRATOR] Fatal error:')
    console.error('[ORCHESTRATOR] Error details:', error)
    throw error
  }
}

