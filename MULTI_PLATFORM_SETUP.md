# Multi-Platform Growth System Setup

## Overview

The system has been expanded to support multiple publishing platforms and includes a CEO AI Coordinator for strategic decision-making.

## New Features

### 1. CEO AI Coordinator
- Strategic coordinator that maintains biible.net's mission
- Analyzes growth opportunities
- Assigns high-level tasks to specialized agents
- Coordinates multi-platform publishing strategy
- Enabled by default (set `CEO_ENABLED=false` to disable)

### 2. Multi-Target Publisher System
- Supports multiple Vercel sites
- Extensible architecture for new platforms
- Platform-specific publishers:
  - **Vercel** (fully implemented) - GitHub PR creation
  - **Medium** (stub ready) - API integration needed
  - **Dev.to** (stub ready) - API integration needed
  - **WordPress** (stub ready) - REST API integration needed
  - **Social Media** (stub ready) - Twitter/X and LinkedIn APIs needed

## Configuration

### Publishing Targets (`config/publishing-targets.json`)

Add or modify publishing targets in this file:

```json
{
  "targets": [
    {
      "id": "biible-main",
      "type": "vercel",
      "enabled": true,
      "priority": 1,
      "config": {
        "repo": "${CONTENT_REPO}",
        "path": "../biible-content-site"
      }
    },
    {
      "id": "biible-secondary",
      "type": "vercel",
      "enabled": true,
      "priority": 2,
      "config": {
        "repo": "username/biible-secondary-site",
        "path": "../biible-secondary-site"
      }
    },
    {
      "id": "medium",
      "type": "medium",
      "enabled": false,
      "priority": 3,
      "config": {
        "apiKey": "${MEDIUM_API_KEY}"
      }
    }
  ]
}
```

**Priority**: Lower numbers = higher priority. Content will be published to enabled targets in priority order.

## Environment Variables

### Required (Existing)
- `OPENAI_API_KEY` - OpenAI API key
- `GH_TOKEN` - GitHub Personal Access Token
- `CONTENT_REPO` - Format: `username/repo-name`

### Optional (New)
- `CEO_ENABLED` - Enable/disable CEO coordinator (default: `true`)
- `MEDIUM_API_KEY` - Medium API integration token
- `DEVTO_API_KEY` - Dev.to API key
- `WORDPRESS_URL` - WordPress site URL
- `WORDPRESS_USER` - WordPress username
- `WORDPRESS_PASSWORD` - WordPress application password
- `TWITTER_API_KEY` - Twitter/X API key
- `TWITTER_API_SECRET` - Twitter/X API secret
- `LINKEDIN_CLIENT_ID` - LinkedIn API client ID
- `LINKEDIN_CLIENT_SECRET` - LinkedIn API client secret

## Adding Multiple Vercel Sites

1. Create additional content repositories on GitHub
2. Deploy each to Vercel
3. Add entries to `config/publishing-targets.json`:

```json
{
  "id": "biible-secondary",
  "type": "vercel",
  "enabled": true,
  "priority": 2,
  "config": {
    "repo": "yourusername/biible-secondary-site",
    "path": "../biible-secondary-site"
  }
}
```

4. The system will automatically publish to all enabled Vercel targets

## How It Works

1. **CEO Coordinator** (if enabled) analyzes the system and makes strategic decisions
2. **Content Pipeline** runs as before (Topic Research → Content Creation → Safety Review)
3. **Multi-Target Publisher** publishes to all enabled platforms simultaneously
4. Results are logged with success/failure status for each platform

## Architecture

```
Orchestrator
  ├── CEO Coordinator (strategic decisions)
  ├── Topic Researcher
  ├── Scripture Mapper
  ├── Content Composer
  ├── SEO Metadata
  ├── Formatter
  ├── Interlinker
  ├── Safety Officer
  └── Multi-Target Publisher
       ├── Vercel Publisher
       ├── Medium Publisher (stub)
       ├── Dev.to Publisher (stub)
       ├── WordPress Publisher (stub)
       └── Social Publisher (stub)
```

## Next Steps

### To Complete Platform Integrations:

1. **Medium**: Implement API calls to `https://api.medium.com/v1/posts`
2. **Dev.to**: Implement API calls to `https://dev.to/api/articles`
3. **WordPress**: Implement REST API calls to `{url}/wp-json/wp/v2/posts`
4. **Social Media**: Implement Twitter API v2 and LinkedIn API integrations

### To Add New Marketing Agents:

Create new agent files in `src/agents/` following the existing pattern:
- Load prompts from `prompts/`
- Use `callLLM()` for AI interactions
- Return structured data using Zod schemas
- Integrate into orchestrator flow

## Backward Compatibility

The system maintains backward compatibility:
- If multi-target publisher fails, falls back to legacy single publisher
- Existing `CONTENT_REPO` and `GH_TOKEN` still work
- CEO coordinator can be disabled if needed

## Logging

The system now logs:
- CEO coordinator decisions
- Multi-platform publishing results
- Success/failure status for each platform
- Platform-specific URLs (e.g., PR URLs, published article URLs)

