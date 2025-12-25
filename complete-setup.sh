#!/bin/bash
# Complete automated setup - run this after authenticating

set -e

echo "🚀 Complete AGS Setup"
echo "===================="
echo ""

# Check authentication
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI not installed. Installing..."
  brew install gh
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️  GitHub CLI not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get repo info
USERNAME=$(gh api user -q .login)
GROWTH_REPO="$USERNAME/biible-growth-system"
CONTENT_REPO="$USERNAME/biible-content-site"

echo "Using repos:"
echo "  Growth: $GROWTH_REPO"
echo "  Content: $CONTENT_REPO"
echo ""

# Check if repos exist, create if not
echo "📦 Checking/creating GitHub repos..."
gh repo view "$GROWTH_REPO" >/dev/null 2>&1 || gh repo create "$GROWTH_REPO" --public --source=. --remote=origin --push || echo "Repo may already exist"
cd ../biible-content-site
gh repo view "$CONTENT_REPO" >/dev/null 2>&1 || gh repo create "$CONTENT_REPO" --public --source=. --remote=origin --push || echo "Repo may already exist"

# Push code
echo ""
echo "📤 Pushing code..."
cd "$SCRIPT_DIR"
git push -u origin main || echo "Push may have failed"

cd ../biible-content-site
git checkout -b main 2>/dev/null || git checkout main 2>/dev/null || true
git branch -M main 2>/dev/null || true
git push -u origin main || echo "Push may have failed"

# Set secrets
echo ""
echo "🔐 Setting GitHub secrets..."
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env | cut -d '=' -f2- | tr -d ' ' | tr -d '"')
  if [ ! -z "$OPENAI_KEY" ]; then
    echo "Setting OPENAI_API_KEY..."
    gh secret set OPENAI_API_KEY --body "$OPENAI_KEY" && echo "✅ Set!"
  fi
fi

echo "Setting CONTENT_REPO..."
gh secret set CONTENT_REPO --body "$CONTENT_REPO" && echo "✅ Set!"

echo ""
echo "⚠️  You need to set GH_TOKEN manually:"
echo "   1. Create token: https://github.com/settings/tokens/new"
echo "   2. Permissions: repo (full control)"
echo "   3. Run: gh secret set GH_TOKEN"
echo ""

# Vercel deployment (manual - requires interactive login)
echo ""
echo "🚀 Vercel Deployment (Manual Step Required):"
echo "   Vercel requires interactive authentication. Choose one:"
echo ""
echo "   Option 1 - Web UI (Recommended):"
echo "   1. Go to: https://vercel.com"
echo "   2. Sign in with GitHub"
echo "   3. Click 'Add New Project'"
echo "   4. Select your biible-content-site repo"
echo "   5. Click 'Deploy'"
echo ""
echo "   Option 2 - CLI (If you prefer):"
echo "   1. cd ../biible-content-site"
echo "   2. vercel login  (this opens your browser)"
echo "   3. vercel --prod"
echo ""

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Set GH_TOKEN secret (see above)"
echo "  2. Test workflow: Go to Actions tab → Run workflow"
