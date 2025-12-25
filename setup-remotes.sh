#!/bin/bash
# Helper to set up git remotes

echo "🔧 Git Remote Setup Helper"
echo ""
echo "To set up remotes, run these commands:"
echo ""
echo "For growth system:"
echo "  cd biible-growth-system"
echo "  git remote add origin https://github.com/YOUR_USERNAME/biible-growth-system.git"
echo "  git push -u origin main"
echo ""
echo "For content site:"
echo "  cd ../biible-content-site"
echo "  git remote set-url origin https://github.com/YOUR_USERNAME/biible-content-site.git"
echo "  git checkout -b main"
echo "  git push -u origin main"
echo ""
echo "Replace YOUR_USERNAME with your GitHub username!"
