# Berlin Simulator: working rules

@AGENTS.md

Full brief: `docs/BRIEF.md`. Plan: `docs/PLAN.md`. Log: `docs/PROGRESS.md`. Decisions: `docs/DECISIONS.md`.

## Language

- Talk to Mer in **German**.
- Code, comments, commit messages, README, docs other than BRIEF: **American English**.

## Autonomy

- Decide technical questions yourself, note them briefly in `docs/DECISIONS.md`, keep going.
- Only ask when truly blocked (secrets, accounts, payments, legally unclear content).
- Manual steps for Mer go into `docs/SETUP.md` as a numbered checklist with exact click paths. Never block on them: use mock mode / localStorage.
- Two serious failed attempts at an approach → switch to the documented fallback and log it.

## Hard constraints

- No hand-made 3D content. Everything is procedural, script-generated, or from CC0 packs fetched by script. `pnpm assets:build` rebuilds all assets.
- Raw data in `data/raw/` (git-ignored). Finished assets in `public/assets/` (committed).
- Never commit secrets. Keep `.env.example` complete. `QWEN_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.
- No `QWEN_API_KEY` → NPC mock replies. No Supabase keys → localStorage.
- Content: no real people, no real brands as shops, no district or group stereotypes, no drug theme for Görlitzer Park, no sexual/violent/hateful content.
- Everything runs in free tiers except Qwen, which is rate-limited.

## Workflow per milestone

1. Plan, implement, test, check visually, commit, update `docs/PLAN.md` and `docs/PROGRESS.md`.
2. Small Conventional Commits. Push after each finished milestone.
3. Visual check with Playwright screenshots at 1440x900 and 390x844; final shots in `docs/screenshots/`.

## Commands

```bash
pnpm dev            # dev server
pnpm check          # lint + typecheck + unit tests
pnpm test           # vitest
pnpm test:e2e       # playwright smoke tests (builds and starts the app)
pnpm build          # production build
pnpm assets:build   # regenerate everything in public/assets
pnpm screenshots    # refresh docs/screenshots
```

## Layout

```
app/                 routes (/, /play, /about, api/*)
components/          React UI overlays and 3D components
game/                game logic, scenes, controller, stores
content/             NPC and place definitions (JSON, Zod-validated)
lib/                 Qwen client, prompts, Supabase, rate limit, schemas
scripts/             asset pipeline
supabase/migrations/ SQL
tests/               unit (vitest) and e2e (playwright)
```
