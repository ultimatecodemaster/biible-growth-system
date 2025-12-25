# How the Autonomous Content System Works

## Two Ways to Run

### 1. Automatic (No Action Needed) ⚡
The system runs **automatically** on a schedule:
- **Monday, Wednesday, Friday at 2pm UTC** (9am EST, 6am PST)
- You don't need to do anything - it just runs!
- Generates content → Creates PRs → You merge → Content goes live

### 2. Manual Trigger (When You Want) 🎯
You can also trigger it manually anytime:

**From GitHub Website:**
1. Go to: https://github.com/ultimatecodemaster/biible-growth-system
2. Click the **"Actions"** tab (at the top)
3. Click **"AGS - Autonomous Growth System"** (left sidebar)
4. Click **"Run workflow"** button (right side)
5. Click **"Run workflow"** (green button)
6. Watch it run!

**From VS Code (if you have GitHub Actions extension):**
- Right-click the workflow file
- Select "Run workflow"

## What Happens When It Runs

1. **Topic Researcher** → Finds 20 Bible questions
2. **Scripture Mapper** → Maps Bible passages to each question
3. **Content Composer** → Writes MDX pages
4. **Safety Officer** → Reviews and approves content
5. **Publisher** → Creates PRs in biible-content-site repo
6. **You** → Merge the PRs (optional - can auto-merge)
7. **Vercel** → Auto-deploys the content
8. **Content** → Live on your website!

## You Don't Need to Do Anything!

Once set up, it runs automatically. You just:
- Check GitHub occasionally for PRs
- Merge PRs when ready
- Content goes live automatically

That's it! The system is fully autonomous.
