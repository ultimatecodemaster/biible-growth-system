# Deployment Guide

## Quick Setup for Autonomous Content Generation

### 1. Deploy Content Website to Vercel

1. Go to [Vercel](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import the `biible-content-site` repository
4. Vercel will auto-detect Astro - click "Deploy"
5. Your site will be live at `biible-content-site.vercel.app` (or your custom domain)

**Auto-deploy is enabled by default** - any push to `main` branch will automatically deploy.

### 2. Configure GitHub Secrets

In the `biible-growth-system` repository, go to:
**Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

- **OPENAI_API_KEY**: Your OpenAI API key (you already have this)
- **GH_TOKEN**: GitHub Personal Access Token
  - Create at: https://github.com/settings/tokens
  - Permissions needed: `repo` (full control of private repositories)
- **CONTENT_REPO**: Format: `yourusername/biible-content-site`
  - Example: `ryanmartin/biible-content-site`

### 3. Test the Workflow

1. Go to **Actions** tab in `biible-growth-system` repository
2. Click on "AGS - Autonomous Growth System" workflow
3. Click "Run workflow" → "Run workflow" (manual trigger)
4. Watch it run - it will:
   - Generate content
   - Create PRs to `biible-content-site`
   - You merge the PRs
   - Vercel auto-deploys

### 4. Schedule

The workflow runs automatically:
- **Monday, Wednesday, Friday at 2pm UTC** (9am EST, 6am PST)
- You can adjust the schedule in `.github/workflows/ags.yml` (cron syntax)

## How It Works

```
GitHub Actions (Scheduled)
  ↓
Growth System Runs
  ↓
Generates MDX Files
  ↓
Safety Officer Approves
  ↓
Publisher Creates PR to biible-content-site
  ↓
You Merge PR (or auto-merge if configured)
  ↓
Vercel Auto-Deploys
  ↓
Content Live on Website
```

## Troubleshooting

### Workflow fails with "Content repo not found"
- Check that `CONTENT_REPO` secret is set correctly (format: `username/repo`)
- Ensure `GH_TOKEN` has access to the content repository

### PRs not being created
- Check `GH_TOKEN` has `repo` permissions
- Verify `CONTENT_REPO` secret is correct

### Website not deploying
- Check Vercel dashboard for build errors
- Ensure `biible-content-site` is connected to Vercel
- Verify the repository has a `main` branch

