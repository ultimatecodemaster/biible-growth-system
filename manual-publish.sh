#!/bin/bash
# Manual script to publish a single draft file

if [ -z "$1" ]; then
  echo "Usage: ./manual-publish.sh <slug>"
  echo "Example: ./manual-publish.sh how-can-i-develop-patience"
  echo ""
  echo "Available drafts:"
  ls -1 data/drafts/*.mdx 2>/dev/null | sed 's|data/drafts/||' | sed 's|\.mdx||' | head -10
  exit 1
fi

SLUG=$1
DRAFT_PATH="data/drafts/${SLUG}.mdx"

if [ ! -f "$DRAFT_PATH" ]; then
  echo "❌ Draft not found: $DRAFT_PATH"
  exit 1
fi

echo "🚀 Manually publishing: $SLUG"
echo ""

# Load env vars
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$GH_TOKEN" ] || [ -z "$CONTENT_REPO" ]; then
  echo "❌ GH_TOKEN or CONTENT_REPO not set in .env"
  exit 1
fi

# Run the publisher directly
cd "$(dirname "$0")"
node -e "
import('./src/agents/publisher.js').then(async (module) => {
  const { runPublisher } = module;
  const { createSlug } = await import('./src/utils/slug.js');
  
  const query = '${SLUG}'.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const slug = '${SLUG}';
  
  console.log('Publishing:', query);
  console.log('Slug:', slug);
  console.log('');
  
  try {
    await runPublisher(query, slug, process.env.CONTENT_REPO, process.env.GH_TOKEN);
    console.log('');
    console.log('✅ Published successfully!');
    console.log('Check GitHub for the PR:');
    console.log('https://github.com/${CONTENT_REPO}/pulls');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
});
"

