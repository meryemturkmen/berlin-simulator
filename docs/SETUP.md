# Manual setup checklist (for Mer)

Nothing here blocks development. Without these steps the app runs in mock mode (canned NPC replies) and stores everything in localStorage.

Steps are added as they become relevant.

## 1. GitHub

- [x] Repo exists and Claude Code can push.

## 2. Supabase

Added in milestone M5.

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

## 4. Vercel

Added in milestone M5.
