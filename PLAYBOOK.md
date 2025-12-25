# PLAYBOOK — Biible Autonomous Growth System (AGS)
This file is the canonical build + behavior spec for the council-style growth engine.

## 1) Goal
Continuously publish real, indexable SEO pages that:
- Answer evergreen, high-intent Bible questions
- Link internally (topic authority)
- Funnel into Biible.net via follow-up query links
- Preserve trust (no manipulation, no doctrinal overreach)

## 2) Council Model
One PM Orchestrator runs role-agents sequentially:
1. topic_researcher
2. scripture_mapper
3. content_composer
4. formatter (optional; local Ollama allowed)
5. interlinker (optional; local Ollama allowed)
6. safety_officer (OpenAI only; final veto)
7. publisher (PR opener)

You run one command; the council runs back-to-back.

## 3) Council Routing
Create config/models.json:

{
  "providers": {
    "openai": { "model": "gpt-4o-mini" },
    "ollama": { "model": "llama3:3b", "baseUrl": "http://127.0.0.1:11434" }
  },
  "routing": {
    "topic_researcher": "openai",
    "scripture_mapper": "openai",
    "content_composer": "openai",
    "safety_officer": "openai",
    "formatter": "ollama",
    "interlinker": "ollama"
  }
}

CLOUD_MODE:
When CLOUD_MODE=true, disable Ollama and route all roles to OpenAI.

## 4) Data Contracts (Schemas)
VerseMap JSON (zod-validated):

{
  query: string,
  cluster: string,
  risk: "low" | "medium" | "high",
  passages: { ref: string, why: string, context: string }[],
  suggested_followups: string[],
  disclaimers: string[]
}

## 5) Hard Rules (Never Break)
- No full verse quotes (refs + brief context only)
- STOP + FLAG high-risk topics: salvation/hell, sexuality, politics, end-times, divorce/remarriage
- Calm, Scripture-first tone; no fear/urgency manipulation
- Safety Officer must always run last (OpenAI) and can veto publishing
- Publish ONLY by PR into biible-content-site

## 6) MDX Page Template (Required Sections)
Every generated page must include:
- # {Exact Query} (H1 exact query)
- Intro (2–4 sentences)
- ## Key passages
  - bullet list with Book Chapter:Verse + context
- ## Common follow-up questions
  - 5–8 links to https://biible.net?q={urlencoded}
- Footer (exact text):
  Scripture doesn’t change. Tools do. Biible.net supports study; it doesn’t replace pastoral counsel.

## 7) Pipeline Steps (Artifacts)
- data/topics.csv
- data/verse_maps/{slug}.json
- data/drafts/{slug}.mdx
- data/flagged/{slug}.json (if vetoed)

## 8) Publishing Mechanism (Web Pages)
Publishing happens because biible-content-site turns MDX files into pages:
- Engine copies approved drafts into:
  biible-content-site/src/content/questions/
- Engine opens PR to that repo
- Human merges PR
- Host auto-deploys and pages go live at:
  /questions/{slug}

## 9) Scripts
package.json must include:
- ags:run → local run
- ags:cloud → sets CLOUD_MODE=true then runs

## 10) Scheduler (Self-hosted Runner Recommended)
Workflow template:

name: AGS
on:
  schedule:
    - cron: "0 14 * * 1,3,5"
  workflow_dispatch: {}
jobs:
  run:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci || npm install
      - env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          CONTENT_REPO: ${{ secrets.CONTENT_REPO }}
          CLOUD_MODE: "true"
        run: npm run ags:cloud
