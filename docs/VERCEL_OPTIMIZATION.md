# Vercel Optimization Guide

This guide explains how to optimize Vercel deployments to prevent blank sites and maximize your free tier usage.

## Vercel Free Tier Limits

The Vercel Hobby (free) plan includes:
- **100 deployments per day** - This resets daily
- **200 projects** - Maximum number of projects
- **100 GB bandwidth per month** - Data transfer limit
- **1 million serverless function invocations per month**
- **45 minutes build time limit per deployment**

## Current Optimization Features

### 1. Content Validation

The system now validates all content before creating PRs to prevent blank deployments:

- **File size check**: Minimum 100 bytes required
- **Frontmatter validation**: Ensures required fields (title, metaTitle, metaDescription, canonicalUrl) are present
- **Content validation**: Verifies actual content exists after frontmatter (minimum 50 characters)
- **Structure validation**: Checks for required headings (H1 or H2)

If validation fails, the PR is **not created**, saving you a deployment.

### 2. Logging

The system logs all validation attempts:
- Success: `Content validation passed for "{query}" (X bytes, Y chars content)`
- Failure: `Content validation failed: {reason}` and `Skipping PR creation for "{query}" - {reason}`

Check your logs to see which content was skipped and why.

## How to Monitor Vercel Usage

### Check Deployment Count

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project (`biible-content-site`)
3. Go to **Settings** → **Usage**
4. View your deployment count for the current day

### Check Bandwidth Usage

1. In the same **Settings** → **Usage** section
2. View your bandwidth consumption for the current month
3. Monitor if you're approaching the 100 GB limit

### View Deployment History

1. In your project dashboard
2. Click **Deployments** tab
3. See all deployments with their status (Ready, Error, etc.)
4. Click on any deployment to see build logs

## Best Practices

### 1. Batch PR Merges (Optional)

Instead of merging PRs one at a time, you can:
- Wait for multiple PRs to accumulate
- Merge them together in a single batch
- This results in **one deployment** instead of multiple

**Note**: The system creates individual PRs, but you control when to merge them.

### 2. Review PRs Before Merging

Always review PRs before merging:
- Check that content looks correct
- Verify the file has actual content (not blank)
- Ensure frontmatter is complete

### 3. Configure Vercel Deployment Settings

In your Vercel project settings:

1. Go to **Settings** → **Git**
2. Configure which branches trigger deployments:
   - **Production Branch**: Usually `main` or `master`
   - **Preview Deployments**: Can disable for draft PRs to save deployments

3. Go to **Settings** → **Build & Development Settings**:
   - Verify build command: `npm run build`
   - Verify output directory: `dist`
   - Add build environment variables if needed

### 4. Use .vercelignore

Add a `.vercelignore` file to your `biible-content-site` repository to exclude unnecessary files from deployments:

1. Copy `.vercelignore.template` from this repo to your content site repo
2. Rename it to `.vercelignore`
3. This reduces build time and deployment size

**Location**: The `.vercelignore` file should be in the root of your `biible-content-site` repository, not in this growth-system repo.

## Troubleshooting

### Too Many Deployments

If you're hitting the 100 deployments/day limit:

1. **Check validation logs**: See if many PRs are being created unnecessarily
2. **Batch merges**: Wait and merge multiple PRs together
3. **Review schedule**: The workflow runs 3x/week (Mon, Wed, Fri) - adjust if needed in `.github/workflows/ags.yml`

### Blank Deployments

If you see blank sites being deployed:

1. **Check validation**: The system should prevent this, but verify logs
2. **Check build logs**: In Vercel dashboard, view deployment logs for errors
3. **Verify content**: Ensure MDX files have proper frontmatter and content

### Build Failures

If deployments are failing:

1. **Check build logs**: In Vercel dashboard → Deployments → Click failed deployment
2. **Common issues**:
   - Missing dependencies (check `package.json`)
   - Build command errors
   - Missing environment variables
   - Astro configuration issues

## Deployment Flow

```
Content Generated
  ↓
Content Validation ✅ (NEW!)
  ↓
PR Created (only if validation passes)
  ↓
You Review & Merge PR
  ↓
Vercel Auto-Deploys
  ↓
Content Live
```

## Summary

- ✅ Content validation prevents blank deployments
- ✅ Logging shows what was skipped and why
- ✅ Monitor usage in Vercel dashboard
- ✅ Batch PR merges to reduce deployment count
- ✅ Use `.vercelignore` to optimize builds

With these optimizations, you should stay well within the free tier limits while ensuring only quality content gets deployed.

