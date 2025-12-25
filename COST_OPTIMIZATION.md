# Cost Optimization Guide

## Problem Identified

The system was making **too many OpenAI API calls**:
- Running every **1 minute** (way too frequent!)
- Processing **21 topics per run**
- Each topic requires **4 API calls** (Scripture Mapper, Content Composer, SEO Metadata, Safety Officer)
- Plus 1 CEO call and 1 Topic Researcher call per run
- **Total: ~86 API calls per run**

If running continuously: **86 calls × 60 runs/hour = 5,160 calls/hour = ~$20/day**

## Solutions Implemented

### 1. Limit Topics Per Run
**Environment Variable:** `MAX_TOPICS_PER_RUN`
- **Default:** 5 topics per run (was unlimited)
- **Usage:** Set to control how many topics are processed each run
- **Example:** `MAX_TOPICS_PER_RUN=3` to process only 3 topics per run

This reduces API calls from ~86 to ~22 per run (5 topics × 4 calls + 2 overhead = 22 calls).

### 2. Increase Wait Time Between Runs
**Environment Variable:** `RUN_INTERVAL_MINUTES`
- **Default:** 60 minutes (was 1 minute!)
- **Usage:** Set how long to wait between runs
- **Example:** `RUN_INTERVAL_MINUTES=120` to wait 2 hours between runs

This prevents the system from running too frequently and burning through API credits.

### 3. Disable CEO Coordinator by Default
**Environment Variable:** `CEO_ENABLED`
- **Default:** `false` (disabled to save costs)
- **Usage:** Set `CEO_ENABLED=true` to enable strategic decision making
- **Saves:** 1 API call per run

### 4. API Usage Tracking & Cost Estimation
The system now tracks:
- Total API calls and tokens used
- Daily API calls and tokens
- Estimated costs (based on gpt-4o-mini pricing)
- Logs summary at end of each run

## Recommended Settings

For **cost-conscious operation**:
```bash
MAX_TOPICS_PER_RUN=3
RUN_INTERVAL_MINUTES=120
CEO_ENABLED=false
```

This gives you:
- **3 topics per run** = ~14 API calls per run
- **Runs every 2 hours** = 12 runs per day
- **Total: ~168 API calls/day** = ~$0.25-0.50/day (much more reasonable!)

For **balanced operation**:
```bash
MAX_TOPICS_PER_RUN=5
RUN_INTERVAL_MINUTES=60
CEO_ENABLED=false
```

This gives you:
- **5 topics per run** = ~22 API calls per run
- **Runs every hour** = 24 runs per day
- **Total: ~528 API calls/day** = ~$0.75-1.50/day

For **maximum content generation** (original behavior):
```bash
MAX_TOPICS_PER_RUN=21
RUN_INTERVAL_MINUTES=1
CEO_ENABLED=true
```

⚠️ **Warning:** This will cost ~$20/day if running continuously!

## How to Set Environment Variables

### Local Development
Create a `.env` file or export before running:
```bash
export MAX_TOPICS_PER_RUN=5
export RUN_INTERVAL_MINUTES=60
export CEO_ENABLED=false
npm run ags:run
```

### GitHub Actions / Vercel
Add to your repository secrets or environment variables:
- Go to Settings → Secrets and variables → Actions
- Add each variable as a secret

### Docker / Production
Add to your docker-compose.yml or deployment config:
```yaml
environment:
  - MAX_TOPICS_PER_RUN=5
  - RUN_INTERVAL_MINUTES=60
  - CEO_ENABLED=false
```

## Monitoring Costs

The system now logs API usage at the end of each run:
```
[ORCHESTRATOR] API Usage Summary:
  Total API Calls: 22
  Total Tokens: 45,230
  Estimated Cost: $0.0068
  Daily Calls: 22
  Daily Tokens: 45,230
  Daily Estimated Cost: $0.0068
```

Check your logs regularly to monitor actual usage and adjust settings as needed.

## Cost Breakdown (gpt-4o-mini)

- **Input tokens:** ~$0.15 per 1M tokens
- **Output tokens:** ~$0.60 per 1M tokens
- **Average per topic:** ~2,000-3,000 tokens total
- **Cost per topic:** ~$0.0003-0.0005

So 5 topics = ~$0.0015-0.0025 per run
With 24 runs/day = ~$0.036-0.06 per day

## Questions?

If you're seeing higher costs than expected:
1. Check your `MAX_TOPICS_PER_RUN` setting
2. Check your `RUN_INTERVAL_MINUTES` setting
3. Review the API usage logs to see actual call counts
4. Consider reducing both settings further if needed

