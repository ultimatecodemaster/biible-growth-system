#!/bin/bash
echo "🔑 API Key Updater"
echo ""
echo "Paste your new API key (should start with 'sk-' not 'sk-proj-'):"
read -s NEW_KEY
echo ""
echo "Updating .env file..."
sed -i.bak "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$NEW_KEY|" .env
echo "✅ Updated! Testing new key..."
node check-api-status.js
