# 🚀 Vercel Setup Guide

## Quick Setup (5 minutes)

### Step 1: Make sure content site is on GitHub

```bash
cd ../biible-content-site
git status
# If there are changes:
git add .
git commit -m "Initial Astro site setup"
git push
```

### Step 2: Deploy to Vercel (Web UI - Easiest)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with your GitHub account
3. **Click "Add New Project"** (big button)
4. **Import Git Repository**:
   - Find `ultimatecodemaster/biible-content-site` in the list
   - Click "Import" next to it
5. **Configure Project**:
   - Framework Preset: Vercel will auto-detect "Astro" ✅
   - Root Directory: `./` (default is fine)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
   - Install Command: `npm install` (auto-detected)
6. **Click "Deploy"** (big button at bottom)
7. **Wait 1-2 minutes** for deployment
8. **✅ Your site is live!** 
   - URL will be something like: `biible-content-site.vercel.app`
   - You can add a custom domain later

### Step 3: Verify It Works

- Visit your Vercel URL
- You should see your site with question listings
- Any future pushes to `main` branch = auto-deploy!

## That's It!

Once deployed, Vercel will:
- ✅ Auto-deploy when you merge PRs
- ✅ Give you a live URL
- ✅ Handle all the hosting

## Optional: Custom Domain

Later, you can add a custom domain:
1. Go to your project in Vercel dashboard
2. Settings → Domains
3. Add your domain

## Troubleshooting

**"Repository not found"**
- Make sure `biible-content-site` is pushed to GitHub
- Make sure you're signed into the right GitHub account

**"Build failed"**
- Check the build logs in Vercel dashboard
- Usually it's a missing dependency or config issue

