#!/bin/bash
# Fix secret in git history by creating fresh branch

echo "Creating clean branch without secrets..."
git checkout --orphan clean-main
git add .
git commit -m "Initial commit - AGS system"
git branch -D main
git branch -m main
git push -f origin main
