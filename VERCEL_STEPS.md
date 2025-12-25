# 🚀 Vercel Deployment - Step by Step

## ✅ GitHub Token: DONE!
Your GitHub token is now configured in `.env`

## 📋 Vercel Setup (5 minutes)

### Step 1: Make sure content site is on GitHub

The content site should already be on GitHub. If you need to push it:

```bash
cd ../biible-content-site
git add .
git commit -m "Initial Astro site setup"
git push
```

### Step 2: Deploy to Vercel

**Follow these exact steps:**

1. **Open**: https://vercel.com in your browser

2. **Sign in**: 
   - Click "Sign Up" or "Log In"
   - Choose "Continue with GitHub"
   - Authorize Vercel to access your GitHub

3. **Add New Project**:
   - After signing in, you'll see a dashboard
   - Click the big **"Add New..."** button (top right)
   - Or click **"Add New Project"** if you see it

4. **Import Repository**:
   - You'll see a list of your GitHub repositories
   - Find **`ultimatecodemaster/biible-content-site`**
   - Click **"Import"** next to it

5. **Configure Project** (Vercel auto-detects most of this):
   - **Framework Preset**: Should show "Astro" ✅ (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
   - **Environment Variables**: Leave empty for now

6. **Deploy**:
   - Click the big **"Deploy"** button at the bottom
   - Wait 1-2 minutes while it builds
   - You'll see build logs in real-time

7. **✅ Done!**
   - When it says "Ready", your site is live!
   - Click the URL (something like `biible-content-site.vercel.app`)
   - Your site is now on the internet! 🌐

### Step 3: Test It

- Visit your Vercel URL
- You should see your site
- Any future PRs you merge = auto-deploy!

## 🎉 That's It!

Now when you run `npm run ags:run`:
1. ✅ Content generates
2. ✅ Publisher creates PRs
3. ✅ You merge PRs
4. ✅ Vercel auto-deploys
5. ✅ Content is live!

## Need Help?

If you get stuck:
- **"Repository not found"**: Make sure you pushed the content site to GitHub
- **"Build failed"**: Check the build logs in Vercel dashboard
- **Can't find the repo**: Make sure you're signed into the right GitHub account

