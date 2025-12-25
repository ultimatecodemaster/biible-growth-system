# 🔧 Vercel Troubleshooting Guide

## Understanding Your Two Projects

You have **TWO different projects** that serve different purposes:

### 1. `biible-growth-system` (This Repo)
- **Purpose**: Backend script that generates content
- **What it shows**: A status dashboard showing system stats
- **URL**: Should be something like `biible-growth-system.vercel.app`
- **What you should see**: A purple gradient page with stats about drafts, flagged content, etc.

### 2. `biible-content-site` (Separate Repo)
- **Purpose**: The actual website that displays Bible content
- **What it shows**: The actual articles and questions
- **URL**: Should be something like `biible-content-site.vercel.app`
- **What you should see**: A website with Bible questions and articles

## Why You're Seeing Blank Pages

### For `biible-growth-system`:
If you see a blank page, it means:
1. The API function isn't being called correctly
2. There's a build error
3. The function is erroring out

**To fix:**
1. Go to Vercel Dashboard → Your `biible-growth-system` project
2. Click on "Deployments" tab
3. Click on the latest deployment
4. Check the "Function Logs" tab
5. Look for errors starting with `[API]`

### For `biible-content-site`:
If you see a blank page, it means:
1. No content has been published yet
2. The site hasn't been built correctly
3. There's a build error

**To fix:**
1. Go to Vercel Dashboard → Your `biible-content-site` project
2. Check the build logs
3. Make sure content files exist in the repo

## Quick Diagnostic Steps

### Step 1: Check Which Projects Are Deployed
1. Go to https://vercel.com/dashboard
2. List all your projects
3. You should see:
   - `biible-growth-system` (status dashboard)
   - `biible-content-site` (actual website)

### Step 2: Test the Growth System Status Page
1. Visit: `https://your-growth-system-url.vercel.app`
2. You should see a purple gradient page
3. If blank, check the Function Logs in Vercel dashboard

### Step 3: Test the Content Site
1. Visit: `https://your-content-site-url.vercel.app`
2. You should see Bible questions/articles
3. If blank, check if any content has been published

### Step 4: Check Deployment Logs
For each project:
1. Go to Vercel Dashboard → Project → Deployments
2. Click the latest deployment
3. Check "Build Logs" for errors
4. Check "Function Logs" (for growth-system) for API errors

## Common Issues

### Issue: "Blank white page on growth-system"
**Solution:**
- Check Function Logs in Vercel
- Look for `[API]` log messages
- The API function should be returning HTML

### Issue: "Blank white page on content-site"
**Solution:**
- Check if any content has been published
- Verify the site has been built
- Check build logs for errors

### Issue: "Can't find the projects"
**Solution:**
- Make sure you're logged into the correct Vercel account
- Check that the repos are connected to Vercel
- You may need to import them again

## What Should Be Deployed Where

### ✅ `biible-growth-system` → Vercel
- Shows: Status dashboard
- Purpose: Monitor the backend system
- Should show: Stats, draft counts, system info

### ✅ `biible-content-site` → Vercel  
- Shows: Actual Bible content website
- Purpose: Public-facing website
- Should show: Questions, articles, content

## Getting Help

If you're still stuck:
1. Check the Function Logs in Vercel (for growth-system)
2. Check the Build Logs in Vercel (for content-site)
3. Share the error messages you see
4. Verify both repos are connected to Vercel correctly

