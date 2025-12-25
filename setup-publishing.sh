#!/bin/bash
# Helper script to set up publishing (GH_TOKEN and CONTENT_REPO)

echo "🔧 Setting Up Publishing Configuration"
echo "========================================"
echo ""

# Detect GitHub username from git remote
GITHUB_USER=$(git config --get remote.origin.url 2>/dev/null | sed 's/.*github.com[:/]\([^/]*\).*/\1/' || echo "")
CONTENT_REPO="${GITHUB_USER}/biible-content-site"

echo "Detected GitHub username: $GITHUB_USER"
echo "Content repo will be: $CONTENT_REPO"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

# Check current GH_TOKEN
CURRENT_TOKEN=$(grep "^GH_TOKEN=" .env | cut -d '=' -f2)
if [ "$CURRENT_TOKEN" != "your_github_token_here" ] && [ ! -z "$CURRENT_TOKEN" ]; then
  echo "✅ GH_TOKEN already set in .env"
  echo ""
  read -p "Do you want to update it? (y/n): " update_token
  if [ "$update_token" != "y" ]; then
    SKIP_TOKEN=true
  fi
else
  SKIP_TOKEN=false
fi

# Get GitHub token
if [ "$SKIP_TOKEN" != "true" ]; then
  echo ""
  echo "📝 GitHub Token Setup"
  echo "--------------------"
  echo "You need a GitHub Personal Access Token to create PRs."
  echo ""
  echo "1. Go to: https://github.com/settings/tokens/new"
  echo "2. Name it: 'AGS Publisher'"
  echo "3. Expiration: No expiration (or 1 year)"
  echo "4. Permissions: Check 'repo' (Full control of private repositories)"
  echo "5. Click 'Generate token'"
  echo "6. Copy the token (you won't see it again!)"
  echo ""
  read -p "Paste your GitHub token here: " gh_token
  
  if [ -z "$gh_token" ]; then
    echo "❌ No token provided. Skipping..."
  else
    # Update .env file
    if grep -q "^GH_TOKEN=" .env; then
      # Replace existing
      if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^GH_TOKEN=.*|GH_TOKEN=$gh_token|" .env
      else
        # Linux
        sed -i "s|^GH_TOKEN=.*|GH_TOKEN=$gh_token|" .env
      fi
    else
      # Add new
      echo "GH_TOKEN=$gh_token" >> .env
    fi
    echo "✅ GH_TOKEN updated in .env"
  fi
fi

# Update CONTENT_REPO
echo ""
echo "📝 Updating CONTENT_REPO..."
if grep -q "^CONTENT_REPO=" .env; then
  # Replace existing
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^CONTENT_REPO=.*|CONTENT_REPO=$CONTENT_REPO|" .env
  else
    # Linux
    sed -i "s|^CONTENT_REPO=.*|CONTENT_REPO=$CONTENT_REPO|" .env
  fi
else
  # Add new
  echo "CONTENT_REPO=$CONTENT_REPO" >> .env
fi
echo "✅ CONTENT_REPO set to: $CONTENT_REPO"

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Test locally: npm run ags:run"
echo "2. Or set up GitHub Actions secrets (for automatic runs)"
echo ""

