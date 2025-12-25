#!/usr/bin/env node

/**
 * Quick status checker for the running orchestrator process
 * Shows how long it's been running and what it might be doing
 */

import { execSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

function getProcessInfo() {
  try {
    // Try multiple patterns to find the process
    const patterns = [
      'tsx src/index.ts',
      'node.*tsx.*index.ts',
      'node.*biible-growth-system.*index'
    ]
    
    let psOutput = ''
    for (const pattern of patterns) {
      try {
        psOutput = execSync(`ps aux | grep "${pattern}" | grep -v grep`, { encoding: 'utf-8' })
        if (psOutput.trim()) break
      } catch (e) {
        continue
      }
    }
    
    if (!psOutput.trim()) {
      return null
    }
    
    const lines = psOutput.trim().split('\n')
    const firstLine = lines[0]
    const parts = firstLine.trim().split(/\s+/)
    const pid = parts[1]
    
    // Get more detailed info
    const detailed = execSync(`ps -p ${pid} -o pid,etime,state,pcpu,pmem,command 2>/dev/null`, { encoding: 'utf-8' })
    const detailLines = detailed.trim().split('\n')
    if (detailLines.length < 2) return null
    
    const info = detailLines[1].trim().split(/\s+/)
    return {
      pid,
      elapsed: info[1],
      state: info[2],
      cpu: info[3],
      mem: info[4]
    }
  } catch (error) {
    return null
  }
}

function getNetworkConnections(pid) {
  try {
    const lsofOutput = execSync(`lsof -p ${pid} 2>/dev/null | grep -E "(TCP|ESTABLISHED)"`, { encoding: 'utf-8' })
    return lsofOutput.trim().split('\n').filter(line => line.includes('ESTABLISHED'))
  } catch (error) {
    return []
  }
}

function getRecentDrafts() {
  try {
    const draftsDir = join(process.cwd(), 'data', 'drafts')
    const files = readdirSync(draftsDir)
      .map(file => {
        const filePath = join(draftsDir, file)
        const stats = statSync(filePath)
        return {
          name: file,
          modified: stats.mtime,
          age: Math.floor((Date.now() - stats.mtime.getTime()) / 1000 / 60) // minutes ago
        }
      })
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 5)
    
    return files
  } catch (error) {
    return []
  }
}

function main() {
  console.log('='.repeat(60))
  console.log('Biible Growth System - Status Check')
  console.log('='.repeat(60))
  console.log()
  
  const processInfo = getProcessInfo()
  
  if (!processInfo) {
    console.log('❌ No orchestrator process found running')
    console.log('   Run: npm run ags:run')
    return
  }
  
  console.log('✅ Process is running')
  console.log(`   PID: ${processInfo.pid}`)
  console.log(`   Runtime: ${processInfo.elapsed}`)
  console.log(`   State: ${processInfo.state} (S=sleeping/waiting, R=running)`)
  console.log(`   CPU: ${processInfo.cpu}%`)
  console.log(`   Memory: ${processInfo.mem}%`)
  console.log()
  
  const connections = getNetworkConnections(processInfo.pid)
  if (connections.length > 0) {
    console.log('🌐 Network connections:')
    connections.forEach(conn => {
      if (conn.includes('https')) {
        console.log(`   → Connected to OpenAI API (waiting for response)`)
      } else {
        console.log(`   → ${conn.split(/\s+/).pop()}`)
      }
    })
    console.log()
  }
  
  const recentDrafts = getRecentDrafts()
  if (recentDrafts.length > 0) {
    console.log('📄 Recent draft files:')
    recentDrafts.forEach(draft => {
      const age = draft.age === 0 ? 'just now' : `${draft.age} minute${draft.age !== 1 ? 's' : ''} ago`
      console.log(`   ${draft.name} (${age})`)
    })
    console.log()
  }
  
  // Interpretation
  if (processInfo.state === 'S') {
    console.log('💡 Status: Process is waiting (likely on OpenAI API response)')
    console.log('   This is normal - API calls can take 10-60+ seconds')
    console.log('   Check the terminal where you ran npm run ags:run for detailed logs')
  } else if (processInfo.state === 'R') {
    console.log('💡 Status: Process is actively running')
  }
  
  console.log()
  console.log('='.repeat(60))
}

main()

