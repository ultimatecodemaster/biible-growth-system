# 🚀 Quick Setup Guide - Get Publishing Working

## Step 1: Get GitHub Token (2 minutes)

1. **Go to**: https://github.com/settings/tokens/new
2. **Name**: `AGS Publisher`
3. **Expiration**: No expiration (or 1 year)
4. **Permissions**: Check ✅ `repo` (Full control of private repositories)
5. **Click**: "Generate token" (green button at bottom)
6. **Copy the token** - you'll see it once, copy it now!

## Step 2: Update .env File

Run this command (it will prompt you for the token):

```bash
cd biible-growth-system
./setup-publishing.sh
```

Or manually edit `.env`:
- Replace `GH_TOKEN=your_github_token_here` with your actual token
- `CONTENT_REPO` is already set to: `ultimatecodemaster/biible-content-site` ✅

## Step 3: Deploy to Vercel (5 minutes)

See `VERCEL_SETUP.md` for detailed steps, or:

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Select `ultimatecodemaster/biible-content-site`
5. Click "Deploy"
6. ✅ Done! Your site is live

## Step 4: Test It!

```bash
# Make sure .env has your real token
npm run ags:run
```

The Publisher will now create PRs automatically! 🎉

## What Happens Next

1. System generates content ✅
2. Publisher creates PRs to `biible-content-site` ✅
3. You merge the PRs
4. Vercel auto-deploys
5. Content is live on the internet! 🌐

