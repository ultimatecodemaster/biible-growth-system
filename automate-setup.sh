#!/bin/bash
# Automated setup script for AGS

set -e

echo "🚀 Automated AGS Setup"
echo ""

# Get repo info
GROWTH_REPO=$(git config --get remote.origin.url 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' || echo "")
CONTENT_REPO="${GROWTH_REPO/biible-growth-system/biible-content-site}"

if [ -z "$GROWTH_REPO" ]; then
  echo "❌ Could not detect GitHub repo. Please set remotes first."
  exit 1
fi

echo "Detected repos:"
echo "  Growth System: $GROWTH_REPO"
echo "  Content Site: $CONTENT_REPO"
echo ""

# Try to push growth system
echo "📤 Pushing growth system..."
cd "$(dirname "$0")"
git push -u origin main 2>&1 && echo "✅ Pushed!" || echo "⚠️  Push failed - may need authentication"

# Try to push content site
echo ""
echo "📤 Pushing content site..."
cd ../biible-content-site
git checkout -b main 2>/dev/null || git checkout main 2>/dev/null || true
git branch -M main 2>/dev/null || true
git push -u origin main 2>&1 && echo "✅ Pushed!" || echo "⚠️  Push failed - may need authentication"

# Try to set secrets if GitHub CLI is available
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo ""
  echo "🔐 Setting up GitHub secrets..."
  cd ../biible-growth-system
  
  # Get OpenAI key from .env
  if [ -f .env ]; then
    OPENAI_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)
    if [ ! -z "$OPENAI_KEY" ]; then
      echo "Setting OPENAI_API_KEY..."
      gh secret set OPENAI_API_KEY --body "$OPENAI_KEY" 2>&1 && echo "✅ Set!" || echo "⚠️  Failed"
    fi
  fi
  
  echo "Setting CONTENT_REPO..."
  gh secret set CONTENT_REPO --body "$CONTENT_REPO" 2>&1 && echo "✅ Set!" || echo "⚠️  Failed"
  
  echo ""
  echo "⚠️  GH_TOKEN needs to be set manually:"
  echo "   1. Create token: https://github.com/settings/tokens/new"
  echo "   2. Run: gh secret set GH_TOKEN"
else
  echo ""
  echo "⚠️  GitHub CLI not available. Set secrets manually:"
  echo "   https://github.com/$GROWTH_REPO/settings/secrets/actions"
fi

# Vercel deployment (manual - requires interactive login)
echo ""
echo "🚀 Vercel Deployment (Manual Step Required):"
echo "   Vercel login must be done interactively. Choose one:"
echo ""
echo "   Option 1 - Web UI (Easiest):"
echo "   1. Go to: https://vercel.com"
echo "   2. Sign in with GitHub"
echo "   3. Click 'Add New Project'"
echo "   4. Select: $CONTENT_REPO"
echo "   5. Click 'Deploy'"
echo ""
echo "   Option 2 - CLI (If you prefer):"
echo "   1. cd ../biible-content-site"
echo "   2. vercel login  (opens browser for auth)"
echo "   3. vercel --prod"
echo ""

echo ""
echo "✅ Setup complete! Check above for any manual steps needed."
