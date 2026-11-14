# Manual setup checklist (for Mer)

Nothing here blocks development. Without these steps the app runs in mock mode (canned NPC replies) and stores everything in localStorage.

The dashboards of Supabase, Alibaba Cloud and Vercel change now and then; menu labels below may differ slightly from what you see.

Suggested order: 2 (Supabase), 3 (Qwen), 4 (Vercel). Each takes about five minutes.

## 1. GitHub

- [x] Repo exists and Claude Code can push.

## 2. Supabase (database and anonymous sign-in)

Without this, progress is stored in the browser's localStorage only. With it, avatar, album, NPC memory and rate limits live in Postgres.

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project** → Organization: yours → Name: `berlin-simulator` → Database password: generate one and store it in your password manager → Region: **Central EU (Frankfurt)** → Plan: Free → **Create new project**. Wait about two minutes.
3. Enable anonymous sign-ins: left sidebar **Authentication** → **Sign In / Providers** → section **User Signups** → switch on **Allow anonymous sign-ins** → **Save changes**.
4. Run the migration (pick one):
   - **Dashboard (simplest):** left sidebar **SQL Editor** → **New query** → paste the full contents of `supabase/migrations/20261114000000_init.sql` → **Run**. Expected result: "Success. No rows returned".
   - **CLI:** `npx supabase login`, then `npx supabase link --project-ref <ref>` (the ref is the part before `.supabase.co` in your project URL), then `npx supabase db push`.
5. Check: left sidebar **Table Editor** shows `profiles`, `experiences`, `npc_memories`, `rate_limits`, `global_usage`, each with the label "RLS enabled".
6. Copy the keys: left sidebar **Project Settings** (gear) → **API Keys** (project URL is under **Data API**):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (server only, never share or commit it)
7. Local development: put the three values in `.env.local` and restart `pnpm dev`. Production: add them in Vercel (section 4).
8. Recommended against bot sign-ups: **Authentication** → **Attack Protection** → enable **Captcha protection** only if you see abuse; the default rate limit for anonymous sign-ins (30 per hour per IP) is fine for a portfolio piece.

Check that it works: play for a minute, then open **Table Editor → profiles**. There should be one row with your avatar name. Talk to an NPC and `npc_memories` and `rate_limits` get rows too.

Notes:

- The anon key is public by design. Row level security makes sure every player only sees their own rows.
- All three values must be set; with only some of them the app keeps using localStorage.
- Free projects are paused after a week without activity. Open the dashboard and click **Restore** if that happens; the game falls back to localStorage in the meantime.

## 3. Qwen (Alibaba Cloud Model Studio)

Without this the NPCs answer from the built-in mock script. With it they are driven by Qwen.

Note: the console could not be opened while writing this, so menu labels are from the public documentation and may differ slightly.

1. Open <https://modelstudio.console.alibabacloud.com/> and sign in (create an Alibaba Cloud account if needed; a payment method is required to activate Model Studio).
2. Top right region switcher: choose **Singapore** (the international region). The default base URL in this project points there.
3. If prompted, click **Activate Now** to enable Model Studio. New accounts get a free token quota.
4. Left menu → **API Keys** (also reachable via the key icon, top right) → **Create API Key** → workspace: default → **OK**. Copy the key (`sk-...`).
5. Local development: copy `.env.example` to `.env.local` and set `QWEN_API_KEY=sk-...`. Restart `pnpm dev`.
6. Production: add the same variable in Vercel (section 4).
7. Optional: `QWEN_MODEL` (default `qwen-flash`, the fast low-cost tier; `qwen-plus` is smarter and pricier) and `QWEN_BASE_URL` (only if your key belongs to another region: Beijing is `https://dashscope.aliyuncs.com/compatible-mode/v1`).
8. Recommended: in the Model Studio console under **Billing / Expenses and Costs**, set a budget alert. The app additionally limits usage with `RATE_LIMIT_PER_HOUR` (per player, default 30) and `RATE_LIMIT_GLOBAL_PER_DAY` (everyone together, default 2000).

Check that it works: start the app, talk to someone in Görlitzer Park and ask something the mock cannot know ("Was hast du heute gefrühstückt?"). The server log line `{"event":"npc_chat","mode":"qwen",...}` confirms the model is used.

## 4. Vercel (hosting)

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. **Import Git Repository** → pick `meryemturkmen/berlin-simulator` → **Import**. (If it is not listed: **Adjust GitHub App Permissions** → grant access to the repository.)
3. Framework Preset: **Next.js** (detected). Root Directory: `./`. Leave build and output settings at their defaults.
4. Open **Environment Variables** and add (Production and Preview):

   | Name                            | Value                          | Needed for             |
   | ------------------------------- | ------------------------------ | ---------------------- |
   | `QWEN_API_KEY`                  | key from section 3             | real NPC conversations |
   | `NEXT_PUBLIC_SUPABASE_URL`      | from section 2                 | database               |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from section 2                 | database               |
   | `SUPABASE_SERVICE_ROLE_KEY`     | from section 2                 | database (server only) |
   | `QWEN_MODEL`                    | optional, default `qwen-flash` |                        |
   | `RATE_LIMIT_PER_HOUR`           | optional, default `30`         |                        |
   | `RATE_LIMIT_GLOBAL_PER_DAY`     | optional, default `2000`       |                        |

   The app also deploys with none of these set: it then runs in mock mode with localStorage.

5. **Deploy**. After about a minute you get a `*.vercel.app` URL. That is the link for your portfolio.
6. Later changes to variables: project → **Settings** → **Environment Variables**, then **Deployments** → latest → **⋯** → **Redeploy** (variables only apply to new deployments).
7. Every push to `main` deploys automatically. Pull requests get preview URLs.

Check that it works: open the URL on your phone and laptop, create an avatar, order a matcha in Mitte.

## 5. Optional

- Custom domain: Vercel project → **Settings** → **Domains**.
- Put the live URL into the README (top, "Play it") and into the GitHub repository's **About → Website** field.
