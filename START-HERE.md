# Biible Autonomous Growth System — START HERE (Council Edition)
This folder contains the only documents you need to point Cursor to.

**Goal:** set up a system that continually publishes real SEO web pages that funnel users to Biible.net.  
**Model:** one PM Orchestrator running multiple role-agents back-to-back (a “council”), with human-on-the-edge for irreversible actions.

---

## What you will do (super simple)
1) Create two GitHub repos (one-time)  
2) Clone them locally  
3) Use Cursor to scaffold the publisher site  
4) Use Cursor to build the autonomous engine  
5) Run one command to generate pages + open PRs  
6) Turn on scheduling (self-hosted runner on your Mac)

---

## PART 1 — Create the two GitHub repos (one-time, manual)
On GitHub (logged in), create **two empty repos**:

1. `biible-content-site`  (leave empty — no README)
2. `biible-growth-system` (leave empty — no README)

Stop. Don’t add anything else.

---

## PART 2 — Clone both repos and open in Cursor
Open Terminal and paste (edit YOURNAME):

cd ~
git clone git@github.com:YOURNAME/biible-content-site.git
git clone git@github.com:YOURNAME/biible-growth-system.git

Open the publisher repo in Cursor:

cd ~/biible-content-site
cursor .

---

## PART 3 — Build the publisher website (this is what becomes “web pages”)
Paste this into **Cursor chat** (inside `biible-content-site`):

Build a fast SEO content site using Astro.

Requirements:
- MDX content stored at /src/content/questions/
- Each MDX file becomes a real web page at /questions/{slug}
- Each page renders:
  - H1 = exact question
  - Short intro (2–4 sentences)
  - Key passages: Book Chapter:Verse + short context (NO full verse quotes)
  - Section titled “Common follow-up questions”
  - Links in that section go to https://biible.net?q={urlencoded}
  - Footer text:
    “Scripture doesn’t change. Tools do. Biible.net supports study; it doesn’t replace pastoral counsel.”
- Topic hub pages at /topics/{topic} listing related questions
- Auto sitemap.xml + RSS feed
- Home page listing topic hubs
- Mobile-first, extremely fast

Provide full working code and commands to run locally and build.

Run locally:

npm install
npm run dev

If it loads, commit + push:

git add .
git commit -m "Initial content site"
git push

Deploy this repo on Vercel / Netlify / Cloudflare Pages.

---

## PART 4 — Open the engine repo (the autonomous marketing team)
In Terminal:

cd ~/biible-growth-system
cursor .

---

## PART 5 — Add alignment files (copy/paste from files in this folder)
In the engine repo root, create:
- MISSION.md (paste from MISSION.md in this download)
- GOVERNANCE.md (paste from GOVERNANCE.md in this download)
- PLAYBOOK.md (paste from PLAYBOOK.md in this download)

---

## PART 6 — Install engine dependencies
In Terminal (engine repo):

npm init -y
npm install openai zod dotenv fs-extra simple-git
npm install -D typescript ts-node

Create .gitignore:

.env
node_modules
tmp
data/

Create .env (DO NOT COMMIT):

OPENAI_API_KEY=YOUR_OPENAI_KEY
OLLAMA_BASE_URL=http://127.0.0.1:11434

Create folders:

mkdir -p pipeline prompts llm config data/drafts data/verse_maps data/flagged data/reports

Create config/models.json (copy from PLAYBOOK.md section “Council routing”).

---

## PART 7 — Build the full council engine with one Cursor prompt
Paste this into Cursor chat (engine repo). This is also saved in CURSOR_BUILD_PROMPT.txt in this download.

Follow PLAYBOOK.md exactly. Implement the entire system end-to-end.

Non-negotiable: multi-agent council with one PM orchestrator and distinct role prompts in /prompts.

Create prompt files in /prompts:
- topic_researcher.md
- scripture_mapper.md
- content_composer.md
- formatter.md
- interlinker.md
- safety_officer.md
- publisher.md

Implement a PM orchestrator that runs roles sequentially:
1) Topic Researcher -> data/topics.csv (20 LOW-risk queries + cluster/topic)
2) Scripture Mapper -> data/verse_maps/{slug}.json (zod-validated)
3) Content Composer -> data/drafts/{slug}.mdx (MDX template)
4) Formatter (optional, local Ollama OK)
5) Interlinker (optional, local Ollama OK)
6) Safety Officer (OpenAI only) -> veto to data/flagged with reason
7) Publisher -> copy approved drafts into biible-content-site/src/content/questions and open PR using GH_TOKEN + CONTENT_REPO

Hard rules:
- No full verse quotes; references + brief context only
- Stop + flag HIGH-risk topics: salvation/hell, sexuality, politics, end-times, divorce/remarriage
- Every MDX page includes:
  - H1 exact query
  - Intro
  - Key passages
  - Common follow-up questions linking to https://biible.net?q={urlencoded}
  - Footer: “Scripture doesn’t change. Tools do. Biible.net supports study; it doesn’t replace pastoral counsel.”

Add npm scripts:
- ags:run
- ags:cloud (CLOUD_MODE=true disables Ollama and uses OpenAI for all roles)

Make it minimal but fully working with clear logs.

---

## PART 8 — Run it locally (the “watch it go” moment)
In Terminal:

npm run ags:run

You should see:
- data/topics.csv
- data/verse_maps/*.json
- data/drafts/*.mdx
- A PR opened in biible-content-site (if you configured GH_TOKEN + CONTENT_REPO)

---

## PART 9 — Enable PR automation (GitHub Secrets)
In biible-growth-system repo → Settings → Secrets and variables → Actions → New secret:
- OPENAI_API_KEY
- GH_TOKEN (GitHub personal access token with repo permissions)
- CONTENT_REPO = YOURNAME/biible-content-site

---

## PART 10 — Make it continual (Self-hosted runner + schedule)
Self-hosted runner:
In GitHub: biible-growth-system → Settings → Actions → Runners → New self-hosted runner  
Follow GitHub’s copy/paste commands on your Mac (leave runner on).

Schedule workflow:
Create .github/workflows/ags.yml in biible-growth-system using the template in PLAYBOOK.md.

Commit and push. Now it runs continually and opens PRs on schedule.

---

## What you do after setup
- Open PRs
- Skim 1–2 pages
- Merge

That’s it.
