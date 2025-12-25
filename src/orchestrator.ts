import { writeFileSync } from 'fs'
import { join } from 'path'
import { runTopicResearcher } from './agents/topic-researcher.js'
import { runScriptureMapper } from './agents/scripture-mapper.js'
import { runContentComposer } from './agents/content-composer.js'
import { runSEOMetadata, injectFrontmatterIntoMDX } from './agents/seo-metadata.js'
import { runFormatter } from './agents/formatter.js'
import { runInterlinker } from './agents/interlinker.js'
import { runSafetyOfficer } from './agents/safety-officer.js'
import { runPublisher } from './agents/publisher.js'
import { runCEOCoordinator, type CEOContext } from './agents/ceo-coordinator.js'
import { publishToAllTargets, getEnabledPublishers } from './publishers/publisher-factory.js'
import { VercelPublisher } from './publishers/vercel-publisher.js'
import type { TopicRow, VerseMap, SEOMetadata } from './schemas.js'

interface ApprovedArticle {
  query: string
  slug: string
  cluster: string
  mdxContent: string
  seoMetadata?: SEOMetadata
  verseMap: VerseMap
}
import { recordError, recordSuccess, getRecoveryStrategy } from './utils/self-improvement.js'
import { canProceedWithAgent, performHealthCheck, recordAgentSuccess, recordAgentFailure, testRecovery } from './utils/health-monitor.js'
import { logWithTime, logError as loggerError, logWarn } from './utils/logger.js'
import { getAPIUsageStats, estimateCost, logAPIUsageSummary } from './utils/api-quota-monitor.js'

// Helper to record both self-improvement and circuit breaker events
function recordAgentEvent(agent: string, success: boolean, error?: Error | unknown, context?: Record<string, unknown>): void {
  if (success) {
    recordSuccess(agent)
    recordAgentSuccess(agent)
  } else {
    recordError(agent, error, context)
    recordAgentFailure(agent)
  }
}

export async function runOrchestrator(): Promise<void> {
  logWithTime('='.repeat(60))
  logWithTime('Biible Autonomous Growth System - Starting')
  logWithTime('='.repeat(60))
  
  // Perform initial health check
  const initialHealth = performHealthCheck()
  logWithTime(`[ORCHESTRATOR] System health: ${initialHealth.status}`)
  
  // Test circuit breaker recovery
  testRecovery()
  
  // CEO Coordinator - Strategic decision making (if enabled)
  // Default to disabled to save API costs - enable with CEO_ENABLED=true
  let ceoDecision = null
  const ceoEnabled = process.env.CEO_ENABLED === 'true'
  if (ceoEnabled) {
    logWithTime('\n[ORCHESTRATOR] CEO Coordinator - Starting strategic analysis...')
    const ceoStart = Date.now()
    try {
      const ceoContext: CEOContext = {
        systemHealth: {
          status: initialHealth.status,
          agentStatuses: initialHealth.agents || {}
        },
        metrics: {
          totalContent: 0 // Will be updated as we process
        }
      }
      ceoDecision = await runCEOCoordinator(ceoContext)
      const ceoDuration = ((Date.now() - ceoStart) / 1000).toFixed(2)
      logWithTime(`[ORCHESTRATOR] CEO Coordinator - Complete (${ceoDuration}s)`)
      logWithTime(`[ORCHESTRATOR] CEO Decision: ${ceoDecision.shouldProceed ? 'PROCEED' : 'HOLD'}`)
      
      if (!ceoDecision.shouldProceed) {
        logWithTime(`[ORCHESTRATOR] CEO Coordinator recommended HOLD: ${ceoDecision.reasoning}`)
        logWithTime(`[ORCHESTRATOR] Exiting per CEO recommendation`)
        return
      }
    } catch (error) {
      recordError('ceo_coordinator', error)
      const ceoDuration = ((Date.now() - ceoStart) / 1000).toFixed(2)
      logWithTime(`[ORCHESTRATOR] CEO Coordinator - Failed after ${ceoDuration}s, continuing with default strategy`)
      logWarn(`[ORCHESTRATOR] CEO Coordinator error`, { error, duration: ceoDuration })
    }
  }
  
  try {
    // Step 1: Topic Researcher
    logWithTime('\n[ORCHESTRATOR] Step 1/8: Topic Researcher - Starting...')
    
    // Check if agent is healthy before proceeding
    const topicResearcherCheck = canProceedWithAgent('topic_researcher')
    if (!topicResearcherCheck.canProceed) {
      logWithTime(`[ORCHESTRATOR] ${topicResearcherCheck.reason}`)
      throw new Error(topicResearcherCheck.reason)
    }
    
    const step1Start = Date.now()
    let topics
    try {
      topics = await runTopicResearcher()
      recordAgentEvent('topic_researcher', true)
    } catch (error) {
      recordAgentEvent('topic_researcher', false, error)
      const recovery = getRecoveryStrategy(error, 'topic_researcher')
      logWithTime(`[ORCHESTRATOR] Topic Researcher error: ${recovery.strategy}`)
      
      if (recovery.shouldRetry && recovery.waitTime > 0) {
        logWithTime(`[ORCHESTRATOR] Waiting ${recovery.waitTime / 1000}s before retry...`)
        await new Promise(resolve => setTimeout(resolve, recovery.waitTime))
        topics = await runTopicResearcher()
        recordAgentEvent('topic_researcher', true)
      } else {
        throw error
      }
    }
    
    const step1Duration = ((Date.now() - step1Start) / 1000).toFixed(2)
    logWithTime(`[ORCHESTRATOR] Step 1/8: Topic Researcher - Complete (${step1Duration}s)`)
    logWithTime(`[ORCHESTRATOR] Generated ${topics.length} topics`)
    
    // Filter to only LOW-risk topics
    const lowRiskTopics = topics.filter(t => t.risk === 'low')
    logWithTime(`[ORCHESTRATOR] Generated ${lowRiskTopics.length} LOW-risk topics`)
    
    // Limit topics per run to control API costs
    const maxTopicsPerRun = parseInt(process.env.MAX_TOPICS_PER_RUN || '5')
    const topicsToProcess = lowRiskTopics.slice(0, maxTopicsPerRun)
    logWithTime(`[ORCHESTRATOR] Processing ${topicsToProcess.length} topics (limited by MAX_TOPICS_PER_RUN=${maxTopicsPerRun})`)
    if (lowRiskTopics.length > maxTopicsPerRun) {
      logWithTime(`[ORCHESTRATOR] Note: ${lowRiskTopics.length - maxTopicsPerRun} topics will be processed in future runs`)
    }
    
    let approvedCount = 0
    let vetoedCount = 0
    const approvedArticles: ApprovedArticle[] = [] // Collect approved articles for batch publishing
    
    // Process each topic through the pipeline
    for (const topic of topicsToProcess) {
      logWithTime(`\n[ORCHESTRATOR] Processing topic: ${topic.query}`)
      const topicStart = Date.now()
      
      try {
        // Step 2: Scripture Mapper
        logWithTime(`[ORCHESTRATOR] Step 2/8: Scripture Mapper - Starting...`)
        
        const scriptureMapperCheck = canProceedWithAgent('scripture_mapper')
        if (!scriptureMapperCheck.canProceed) {
          logWithTime(`[ORCHESTRATOR] ${scriptureMapperCheck.reason}`)
          vetoedCount++
          continue
        }
        
        const step2Start = Date.now()
        let slug: string
        let verseMap: VerseMap
        
        try {
          const result = await runScriptureMapper(topic)
          slug = result.slug
          verseMap = result.verseMap
          recordAgentEvent('scripture_mapper', true)
        } catch (error) {
          recordAgentEvent('scripture_mapper', false, error, { topic: topic.query })
          const recovery = getRecoveryStrategy(error, 'scripture_mapper')
          logWithTime(`[ORCHESTRATOR] Scripture Mapper error: ${recovery.strategy}`)
          
          if (recovery.shouldRetry && recovery.waitTime > 0) {
            logWithTime(`[ORCHESTRATOR] Waiting ${recovery.waitTime / 1000}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, recovery.waitTime))
            const result = await runScriptureMapper(topic)
            slug = result.slug
            verseMap = result.verseMap
            recordAgentEvent('scripture_mapper', true)
          } else {
            throw error
          }
        }
        
        const step2Duration = ((Date.now() - step2Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 2/8: Scripture Mapper - Complete (${step2Duration}s)`)
        
        // Check if HIGH-risk after mapping
        if (verseMap.risk === 'high') {
          logWithTime(`[ORCHESTRATOR] Topic flagged as HIGH-risk after mapping. Skipping.`)
          vetoedCount++
          continue
        }
        
        // Step 3: Content Composer
        logWithTime(`[ORCHESTRATOR] Step 3/8: Content Composer - Starting...`)
        
        const contentComposerCheck = canProceedWithAgent('content_composer')
        if (!contentComposerCheck.canProceed) {
          logWithTime(`[ORCHESTRATOR] ${contentComposerCheck.reason}`)
          vetoedCount++
          continue
        }
        
        const step3Start = Date.now()
        let mdxContent: string
        
        try {
          mdxContent = await runContentComposer(topic.query, verseMap, slug)
          recordAgentEvent('content_composer', true)
        } catch (error) {
          recordAgentEvent('content_composer', false, error, { topic: topic.query, slug })
          const recovery = getRecoveryStrategy(error, 'content_composer')
          logWithTime(`[ORCHESTRATOR] Content Composer error: ${recovery.strategy}`)
          
          if (recovery.shouldRetry && recovery.waitTime > 0) {
            logWithTime(`[ORCHESTRATOR] Waiting ${recovery.waitTime / 1000}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, recovery.waitTime))
            mdxContent = await runContentComposer(topic.query, verseMap, slug)
            recordAgentEvent('content_composer', true)
          } else {
            throw error
          }
        }
        
        const step3Duration = ((Date.now() - step3Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 3/8: Content Composer - Complete (${step3Duration}s)`)
        
        // Step 4: SEO Metadata Agent
        logWithTime(`[ORCHESTRATOR] Step 4/8: SEO Metadata Agent - Starting...`)
        const step4Start = Date.now()
        let seoMetadata: SEOMetadata | undefined
        try {
          const seoResult = await runSEOMetadata(topic.query, verseMap, mdxContent, slug)
          mdxContent = injectFrontmatterIntoMDX(mdxContent, seoResult.frontmatter)
          seoMetadata = seoResult.metadata
          recordSuccess('seo_metadata')
          const step4Duration = ((Date.now() - step4Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 4/8: SEO Metadata Agent - Complete (${step4Duration}s)`)
          logWithTime(`[ORCHESTRATOR] Generated SEO metadata: ${seoResult.metadata.metaTitle}`)
        } catch (error) {
          recordError('seo_metadata', error, { topic: topic.query, slug })
          const step4Duration = ((Date.now() - step4Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 4/8: SEO Metadata Agent - Failed after ${step4Duration}s, continuing without SEO metadata`)
          logWarn(`[ORCHESTRATOR] SEO Metadata error`, { error, topic: topic.query, slug, duration: step4Duration })
        }
        
        // Step 5: Formatter (optional)
        logWithTime(`[ORCHESTRATOR] Step 5/8: Formatter - Starting...`)
        const step5Start = Date.now()
        try {
          mdxContent = await runFormatter(mdxContent)
          recordSuccess('formatter')
          const step5Duration = ((Date.now() - step5Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 5/8: Formatter - Complete (${step5Duration}s)`)
        } catch (error) {
          recordError('formatter', error, { slug })
          const step5Duration = ((Date.now() - step5Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 5/8: Formatter - Failed after ${step5Duration}s, continuing with original content`)
          logWarn(`[ORCHESTRATOR] Formatter error`, { error, slug, duration: step5Duration })
        }
        
        // Step 6: Interlinker (optional)
        logWithTime(`[ORCHESTRATOR] Step 6/8: Interlinker - Starting...`)
        const step6Start = Date.now()
        try {
          mdxContent = await runInterlinker(mdxContent)
          recordSuccess('interlinker')
          const step6Duration = ((Date.now() - step6Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 6/8: Interlinker - Complete (${step6Duration}s)`)
        } catch (error) {
          recordError('interlinker', error, { slug })
          const step6Duration = ((Date.now() - step6Start) / 1000).toFixed(2)
          logWithTime(`[ORCHESTRATOR] Step 6/8: Interlinker - Failed after ${step6Duration}s, continuing with original content`)
          logWarn(`[ORCHESTRATOR] Interlinker error`, { error, slug, duration: step6Duration })
        }
        
        // Save updated MDX content back to draft
        const draftPath = join(process.cwd(), 'data', 'drafts', `${slug}.mdx`)
        writeFileSync(draftPath, mdxContent, 'utf-8')
        logWithTime(`[ORCHESTRATOR] Draft saved: ${slug}.mdx`)
        
        // Step 7: Safety Officer
        logWithTime(`[ORCHESTRATOR] Step 7/8: Safety Officer - Starting...`)
        
        const safetyOfficerCheck = canProceedWithAgent('safety_officer')
        if (!safetyOfficerCheck.canProceed) {
          logWithTime(`[ORCHESTRATOR] ${safetyOfficerCheck.reason}`)
          logWithTime(`[ORCHESTRATOR] Safety Officer is critical - cannot skip. Vetoing content.`)
          vetoedCount++
          continue
        }
        
        const step7Start = Date.now()
        let safetyReview
        
        try {
          safetyReview = await runSafetyOfficer(topic.query, verseMap, mdxContent, slug)
          recordAgentEvent('safety_officer', true)
        } catch (error) {
          recordAgentEvent('safety_officer', false, error, { topic: topic.query, slug })
          const recovery = getRecoveryStrategy(error, 'safety_officer')
          logWithTime(`[ORCHESTRATOR] Safety Officer error: ${recovery.strategy}`)
          
          if (recovery.shouldRetry && recovery.waitTime > 0) {
            logWithTime(`[ORCHESTRATOR] Waiting ${recovery.waitTime / 1000}s before retry...`)
            await new Promise(resolve => setTimeout(resolve, recovery.waitTime))
            safetyReview = await runSafetyOfficer(topic.query, verseMap, mdxContent, slug)
            recordAgentEvent('safety_officer', true)
          } else {
            // Safety Officer is critical - if it fails, veto the content
            logWithTime(`[ORCHESTRATOR] Safety Officer failed and cannot retry. Vetoing content for safety.`)
            vetoedCount++
            continue
          }
        }
        
        const step7Duration = ((Date.now() - step7Start) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Step 7/8: Safety Officer - Complete (${step7Duration}s)`)
        
        if (!safetyReview.approved) {
          logWithTime(`[ORCHESTRATOR] Content vetoed by Safety Officer: ${safetyReview.reason}`)
          vetoedCount++
          continue
        }
        
        // Step 8: Collect approved article for batch publishing
        // Instead of publishing immediately, collect for batch publishing by cluster
        approvedArticles.push({
          query: topic.query,
          slug,
          cluster: topic.cluster, // Use cluster from the topic
          mdxContent,
          seoMetadata,
          verseMap
        })
        
        const topicDuration = ((Date.now() - topicStart) / 1000).toFixed(2)
        approvedCount++
        logWithTime(`[ORCHESTRATOR] ✓ Approved and queued: ${topic.query} (${topic.cluster}) (Total: ${topicDuration}s)`)
        
      } catch (error) {
        const topicDuration = ((Date.now() - topicStart) / 1000).toFixed(2)
        logWithTime(`[ORCHESTRATOR] Error processing topic "${topic.query}" after ${topicDuration}s:`)
        loggerError(`[ORCHESTRATOR] Error details`, error, { topic: topic.query, duration: topicDuration })
        recordError('orchestrator', error, { topic: topic.query })
        vetoedCount++
      }
    }
    
    // After processing all topics, publish by cluster in batches
    if (approvedArticles.length > 0) {
      logWithTime(`\n[ORCHESTRATOR] Publishing ${approvedArticles.length} approved articles grouped by cluster...`)
      
      // Group by cluster
      const clusterGroups = new Map<string, ApprovedArticle[]>()
      for (const article of approvedArticles) {
        const cluster = article.cluster || 'general'
        if (!clusterGroups.has(cluster)) {
          clusterGroups.set(cluster, [])
        }
        clusterGroups.get(cluster)!.push(article)
      }
      
      logWithTime(`[ORCHESTRATOR] Grouped into ${clusterGroups.size} cluster(s)`)
      
      // Publish each cluster as a batch
      for (const [cluster, articles] of clusterGroups.entries()) {
        logWithTime(`\n[ORCHESTRATOR] Publishing cluster: ${cluster} (${articles.length} articles)`)
        
        try {
          // Get Vercel publisher from factory
          const publishers = getEnabledPublishers()
          const vercelPublisher = publishers.find(p => p instanceof VercelPublisher) as VercelPublisher | undefined
          
          if (vercelPublisher && typeof (vercelPublisher as any).publishBatch === 'function') {
            const batchItems = articles.map(a => ({
              query: a.query,
              slug: a.slug,
              cluster: a.cluster
            }))
            
            const result = await (vercelPublisher as any).publishBatch(batchItems)
            
            if (result.success) {
              logWithTime(`[ORCHESTRATOR] ✅ Published ${cluster} cluster: ${result.url}`)
              logWithTime(`[ORCHESTRATOR] 📦 ${articles.length} articles in batch`)
              recordAgentEvent('publisher', true)
            } else {
              logWithTime(`[ORCHESTRATOR] ❌ Failed to publish ${cluster} cluster: ${result.error}`)
              recordAgentEvent('publisher', false, new Error(result.error || 'Batch publish failed'), { cluster, articleCount: articles.length })
            }
          } else {
            // Fallback: publish individually if batch method not available
            logWithTime(`[ORCHESTRATOR] Batch publishing not available, publishing individually...`)
            for (const article of articles) {
              try {
                const publishResults = await publishToAllTargets({
                  query: article.query,
                  slug: article.slug,
                  mdxContent: article.mdxContent,
                  seoMetadata: article.seoMetadata,
                  verseMap: article.verseMap
                })
                
                const successCount = publishResults.filter(r => r.success).length
                if (successCount > 0) {
                  recordAgentEvent('publisher', true)
                } else {
                  recordAgentEvent('publisher', false, new Error('All publishers failed'), { query: article.query })
                }
              } catch (error) {
                recordAgentEvent('publisher', false, error, { query: article.query })
              }
            }
          }
        } catch (error) {
          logWithTime(`[ORCHESTRATOR] Error publishing ${cluster} cluster: ${error}`)
          recordError('publisher', error, { cluster, articleCount: articles.length })
        }
      }
    } else {
      logWithTime(`[ORCHESTRATOR] No approved articles to publish`)
    }
    
    logWithTime('\n' + '='.repeat(60))
    logWithTime('Biible Autonomous Growth System - Complete')
    logWithTime('='.repeat(60))
    logWithTime(`Approved: ${approvedCount}`)
    logWithTime(`Vetoed/Skipped: ${vetoedCount}`)
    logWithTime(`Total Processed: ${topicsToProcess.length}`)
    
    // Log API usage and cost estimate for this run
    const stats = getAPIUsageStats()
    const estimatedCost = estimateCost(stats.total.tokens)
    logWithTime(`\n[ORCHESTRATOR] API Usage Summary:`)
    logWithTime(`  Total API Calls: ${stats.total.requests}`)
    logWithTime(`  Total Tokens: ${stats.total.tokens.toLocaleString()}`)
    logWithTime(`  Estimated Cost: $${estimatedCost.toFixed(4)}`)
    logWithTime(`  Daily Calls: ${stats.daily.requests}`)
    logWithTime(`  Daily Tokens: ${stats.daily.tokens.toLocaleString()}`)
    const dailyCost = estimateCost(stats.daily.tokens)
    logWithTime(`  Daily Estimated Cost: $${dailyCost.toFixed(4)}`)
    
    // Perform final health check
    const finalHealth = performHealthCheck()
    logWithTime(`[ORCHESTRATOR] Final system health: ${finalHealth.status}`)
    
  } catch (error) {
    logWithTime('[ORCHESTRATOR] Fatal error:')
    loggerError('[ORCHESTRATOR] Error details', error, { type: 'fatal' })
    recordError('orchestrator', error, { type: 'fatal' })
    throw error
  }
}

