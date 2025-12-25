#!/bin/bash
# Helper script to guide GitHub secrets setup

echo "🔐 GitHub Secrets Setup Guide"
echo ""
echo "Go to: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions"
echo ""
echo "Add these 3 secrets:"
echo ""
echo "1. OPENAI_API_KEY"
echo "   Value: (your existing OpenAI API key)"
echo ""
echo "2. GH_TOKEN"
echo "   Create at: https://github.com/settings/tokens/new"
echo "   Name: AGS Publisher"
echo "   Permissions: repo (Full control)"
echo "   Expiration: No expiration"
echo ""
echo "3. CONTENT_REPO"
echo "   Value: $(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | sed 's/biible-growth-system/biible-content-site/')"
echo ""
echo "After adding secrets, test the workflow from the Actions tab!"

