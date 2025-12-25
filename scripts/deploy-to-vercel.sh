#!/bin/bash
# Helper script to prepare for Vercel deployment

echo "🚀 Vercel Deployment Preparation"
echo ""
echo "1. First, push the content site to GitHub:"
echo "   cd ../biible-content-site"
echo "   git add ."
echo "   git commit -m 'Initial Astro site setup'"
echo "   git push"
echo ""
echo "2. Then deploy to Vercel:"
echo "   • Go to: https://vercel.com"
echo "   • Sign in with GitHub"
echo "   • Click 'Add New Project'"
echo "   • Select 'biible-content-site'"
echo "   • Vercel will auto-detect Astro"
echo "   • Click 'Deploy'"
echo ""
echo "3. Your site will be live automatically!"
echo "   Any push to main branch = auto-deploy"

