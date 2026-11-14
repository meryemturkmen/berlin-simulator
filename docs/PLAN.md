# Implementation plan

Checked items are done and verified. See `docs/PROGRESS.md` for the log and `docs/DECISIONS.md` for the reasoning.

## M0: Foundation

- [x] Next.js (App Router), TypeScript strict, Tailwind, pnpm
- [x] ESLint, Prettier
- [x] Vitest and Playwright set up with one test each
- [x] GitHub Actions: lint, typecheck, unit tests, build, e2e
- [x] `.env.example`, `CLAUDE.md`, docs files
- [x] `/play`: empty 3D scene with ground, light, sky
- [x] Acceptance: `pnpm build` and all checks green, CI running

## M1: Avatar and movement

- [x] Avatar schema (Zod) and store with localStorage persistence
- [x] Avatar model: procedural low-poly fallback (see DECISIONS D4)
- [x] Title screen and avatar editor with rotatable live preview
- [x] Third-person controller on Rapier: WASD/arrows, run, camera orbit
- [x] Mobile: virtual joystick and touch camera
- [x] Idle and walk animation
- [x] Acceptance: Playwright creates an avatar and moves it; screenshots desktop and mobile reviewed

## M2: First real place (Görlitzer Park)

- [x] `scripts/fetch_lod2`: resolve and download LoD2 tiles from Geoportal Berlin
- [x] `scripts/fetch_osm`: Overpass query for paths, green, water, trees, benches
- [x] `scripts/build_buildings`: CityGML → clipped, triangulated, centered GLB
- [x] `scripts/build_place`: environment geometry, colliders, manifest
- [x] Compression with gltf-transform; `pnpm assets:build` runs everything
- [x] Place scene: stylized materials, procedural windows, instanced trees and benches
- [x] Collision and invisible play-area bounds
- [x] Day-night cycle with sky, soft light, shadows
- [x] Sit down on benches and picnic blankets
- [x] Acceptance: pipeline runs clean, GLB under target size, scene loads < 5 s locally, screenshots look right

## M3: NPC role play

- [x] NPC schema and three Görli NPCs in `content/npcs`
- [x] Prompt builder with guardrails and injection protection
- [x] Qwen client (OpenAI-compatible) with streaming
- [x] Reply schema, tolerant JSON parsing, fallback reply
- [x] Mock mode without `QWEN_API_KEY`
- [x] Rate limit (per user per hour, global per day) with in-memory store
- [x] `/api/npc/chat` route handler
- [x] Chat overlay with "Talk (E)" hint, streamed text, emotions
- [x] Actions trigger game events
- [x] Memory: last messages plus summary per player and NPC (localStorage for now)
- [x] Acceptance: unit tests for prompt, schema, rate limit; Playwright chats in mock mode; injection cases handled

## M4: Map, teleport, Mitte and Ku'damm

- [x] District boundaries by script → simplified map data
- [x] Map overlay (key `M` and button) with place markers
- [x] Teleport with transition and loading screen with a Berlin fact
- [x] Lazy-loaded scene per place
- [x] Mitte: café corner, outdoor seating, barista, drink order → inventory and experience
- [x] Ku'damm: boulevard, shop fronts with invented names, benches, three NPCs
- [x] Acceptance: Playwright teleports to all three places; screenshots of all places reviewed

## M5: Supabase

- [ ] Migrations: `profiles`, `npc_memories`, `experiences`, `rate_limits`, RLS, rate-limit function
- [ ] Anonymous sign-in on the client
- [ ] Storage layer: Supabase when configured, else localStorage
- [ ] Server: verify user token, service role only in route handlers
- [ ] Rate limit and memory backed by Supabase
- [ ] Acceptance: data-access tests; `docs/SETUP.md` has exact steps

## M6: Atmosphere and experiences

- [ ] Procedural ambient sound per place, quiet by default, mute button
- [ ] Instanced background pedestrians on simple paths
- [ ] Berlin album UI with 3 to 5 experiences per place
- [ ] Emotion emoji above NPCs
- [ ] Quality levels: auto-detect plus manual setting

## M7: Portfolio polish

- [ ] README with hero screenshot, features, architecture diagram, stack, local start, licenses
- [ ] `/about` page with Mermaid diagram and data sources
- [ ] `public/assets/LICENSES.md`
- [ ] Lighthouse check of the start page
- [ ] Final run of all tests
