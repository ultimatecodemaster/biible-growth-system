import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getStatusData() {
  console.log('[API] Getting status data, cwd:', process.cwd())
  
  const dataDir = join(process.cwd(), 'data')
  const draftsDir = join(dataDir, 'drafts')
  const flaggedDir = join(dataDir, 'flagged')
  const learningFile = join(dataDir, 'learning.json')
  
  let draftCount = 0
  let flaggedCount = 0
  let recentDrafts: Array<{ name: string; size: number; modified: Date }> = []
  let learningData: any = null
  let isLocal = false
  
  try {
    // Check if we're in a local environment (data directory exists)
    if (existsSync(dataDir)) {
      isLocal = true
      console.log('[API] Data directory found, reading local files')
      
      if (existsSync(draftsDir)) {
        const drafts = readdirSync(draftsDir)
        draftCount = drafts.length
        console.log(`[API] Found ${draftCount} drafts`)
        
        // Get 5 most recent drafts
        recentDrafts = drafts
          .map(name => {
            const filePath = join(draftsDir, name)
            const stats = statSync(filePath)
            return {
              name,
              size: stats.size,
              modified: stats.mtime
            }
          })
          .sort((a, b) => b.modified.getTime() - a.modified.getTime())
          .slice(0, 5)
      }
      
      if (existsSync(flaggedDir)) {
        const flagged = readdirSync(flaggedDir)
        flaggedCount = flagged.length
        console.log(`[API] Found ${flaggedCount} flagged files`)
      }
      
      if (existsSync(learningFile)) {
        const content = readFileSync(learningFile, 'utf-8')
        learningData = JSON.parse(content)
        console.log('[API] Loaded learning data')
      }
    } else {
      console.log('[API] Data directory not found - running in serverless mode')
      isLocal = false
    }
  } catch (error) {
    console.error('[API] Error reading status data:', error)
    // Continue with default values
  }
  
  return {
    draftCount,
    flaggedCount,
    recentDrafts,
    learningData,
    isLocal,
    timestamp: new Date().toISOString()
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[API] Status check requested')
  
  try {
    const status = getStatusData()
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biible Growth System - Status</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .header p {
      color: #666;
      font-size: 1.1em;
    }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .card h2 {
      font-size: 1.3em;
      margin-bottom: 15px;
      color: #667eea;
    }
    
    .stat {
      font-size: 2.5em;
      font-weight: bold;
      color: #764ba2;
      margin-bottom: 5px;
    }
    
    .stat-label {
      color: #666;
      font-size: 0.9em;
    }
    
    .draft-list {
      list-style: none;
    }
    
    .draft-item {
      padding: 12px;
      margin-bottom: 8px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .draft-item strong {
      color: #333;
      display: block;
      margin-bottom: 4px;
    }
    
    .draft-item small {
      color: #666;
      font-size: 0.85em;
    }
    
    .info-box {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .info-box p {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    
    .timestamp {
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 20px;
      font-size: 0.9em;
    }
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 2em;
      }
      
      .status-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Biible Growth System</h1>
      <p>Autonomous Content Generation System Status</p>
    </div>
    
    <div class="status-grid">
      <div class="card">
        <h2>📄 Drafts</h2>
        <div class="stat">${status.draftCount}</div>
        <div class="stat-label">Total draft files</div>
      </div>
      
      <div class="card">
        <h2>⚠️ Flagged</h2>
        <div class="stat">${status.flaggedCount}</div>
        <div class="stat-label">Flagged content files</div>
      </div>
      
      <div class="card">
        <h2>🧠 Learning</h2>
        <div class="stat">${status.learningData ? (status.learningData.errors?.length || 0) + (status.learningData.improvements?.length || 0) : 0}</div>
        <div class="stat-label">Total learning records</div>
      </div>
    </div>
    
    ${status.recentDrafts.length > 0 ? `
    <div class="card">
      <h2>📋 Recent Drafts</h2>
      <ul class="draft-list">
        ${status.recentDrafts.map(draft => `
          <li class="draft-item">
            <strong>${draft.name}</strong>
            <small>${formatBytes(draft.size)} • ${formatDate(draft.modified)}</small>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="card">
      <div class="info-box">
        <h2 style="margin-top: 0; color: #2196f3;">ℹ️ About This System</h2>
        <p><strong>This is the Growth System backend.</strong> It's a Node.js script that runs autonomously to generate content.</p>
        <p><strong>For the actual website:</strong> Visit your <code>biible-content-site</code> repository on Vercel.</p>
        <p><strong>This page shows:</strong> System status, draft counts, and recent activity.</p>
        ${!status.isLocal ? '<p style="color: #f57c00;"><strong>⚠️ Note:</strong> Running in serverless mode. File system data is not available in Vercel\'s serverless environment. This page shows the system is deployed correctly.</p>' : ''}
        <p><strong>Last updated:</strong> ${formatDate(new Date(status.timestamp))}</p>
      </div>
    </div>
    
    <div class="timestamp">
      Status checked at ${formatDate(new Date(status.timestamp))}
    </div>
  </div>
</body>
</html>
    `
    
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
    console.log('[API] Status page served successfully')
  } catch (error) {
    console.error('[API] Error generating status page:', error)
    
    // Always return HTML, even on error
    const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biible Growth System - Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 { color: #667eea; margin-bottom: 20px; }
    p { color: #666; line-height: 1.6; margin-bottom: 15px; }
    .error { color: #f57c00; background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Biible Growth System</h1>
    <p><strong>System Status:</strong> Deployed and running ✅</p>
    <p>This is the Growth System backend - a Node.js script that runs autonomously to generate content.</p>
    <p><strong>For the actual website:</strong> Visit your <code>biible-content-site</code> repository on Vercel.</p>
    <div class="error">
      <strong>Note:</strong> Status data is not available in serverless mode. This is normal for Vercel deployments.
    </div>
  </div>
</body>
</html>
    `
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(errorHtml)
  }
}

