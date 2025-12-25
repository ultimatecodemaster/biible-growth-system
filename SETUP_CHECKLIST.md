# Setup Checklist - Autonomous Content System

Follow these steps in order to get everything running.

## ✅ Step 1: Fix Astro Build (If Needed)

If the build fails, the site will still work but you may need to adjust the routing. The current setup should work once deployed to Vercel.

## ✅ Step 2: Deploy Content Site to Vercel

1. **Push content site to GitHub** (if not already):
   ```bash
   cd ../biible-content-site
   git add .
   git commit -m "Initial Astro site setup"
   git push
   ```

2. **Deploy to Vercel**:
   - Go to https://vercel.com and sign in with GitHub
   - Click "Add New Project"
   - Select `biible-content-site` repository
   - Vercel will auto-detect Astro
   - Click "Deploy"
   - Your site will be live at `biible-content-site.vercel.app` (or custom domain)

3. **Verify deployment**:
   - Visit your Vercel URL
   - Should see the home page with question listings
   - Auto-deploy is enabled by default (any push to `main` = new deployment)

## ✅ Step 3: Configure GitHub Secrets

In the `biible-growth-system` repository:

1. Go to: **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"** for each:

   **OPENAI_API_KEY**
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (you already have this: `sk-proj-R5Gswfmu2NXo...`)

   **GH_TOKEN**
   - Name: `GH_TOKEN`
   - Value: GitHub Personal Access Token
     - Create at: https://github.com/settings/tokens/new
     - Name: "AGS Publisher"
     - Expiration: No expiration (or 1 year)
     - Permissions: Check `repo` (Full control of private repositories)
     - Click "Generate token"
     - Copy the token immediately (you won't see it again)

   **CONTENT_REPO**
   - Name: `CONTENT_REPO`
   - Value: `yourusername/biible-content-site`
     - Replace `yourusername` with your GitHub username
     - Example: `ryanmartin/biible-content-site`

## ✅ Step 4: Test the Workflow

1. **Push the workflow to GitHub**:
   ```bash
   cd biible-growth-system
   git add .github/workflows/ags.yml
   git commit -m "Add AGS workflow"
   git push
   ```

2. **Trigger manually**:
   - Go to GitHub → `biible-growth-system` → **Actions** tab
   - Click "AGS - Autonomous Growth System"
   - Click "Run workflow" → "Run workflow"
   - Or use VS Code GitHub Actions extension to trigger it

3. **Watch it run**:
   - Should see it generate content
   - Check for PRs created in `biible-content-site` repo
   - Merge the PRs
   - Vercel will auto-deploy

## ✅ Step 5: Verify Everything Works

- [ ] Content site is live on Vercel
- [ ] GitHub secrets are configured
- [ ] Workflow runs successfully
- [ ] PRs are created automatically
- [ ] Merging PRs triggers Vercel deployment
- [ ] Content appears on live site

## 🎉 You're Done!

The system will now run automatically:
- **Monday, Wednesday, Friday at 2pm UTC** (9am EST, 6am PST)
- Generates new content
- Creates PRs automatically
- You just merge PRs when ready
- Content goes live automatically

## Troubleshooting

**Workflow fails:**
- Check GitHub secrets are set correctly
- Verify `CONTENT_REPO` format: `username/repo`
- Check `GH_TOKEN` has `repo` permissions

**No PRs created:**
- Check workflow logs in Actions tab
- Verify Publisher agent is running (check logs)
- Ensure `GH_TOKEN` has access to content repo

**Site not deploying:**
- Check Vercel dashboard for build errors
- Verify Astro build works locally: `npm run build`
- Check Vercel project is connected to correct repo

