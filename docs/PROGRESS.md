# Progress log

Newest entry first.

## M3: NPC role play (done)

- NPC definitions in `content/npcs/*.json`, validated with Zod (persona, speech style with dialect 0 to 3, knowledge, goals, mood, boundaries, actions, look, greetings, mock script).
- Three NPCs in Görlitzer Park: Jule (musician), Tarek (student having a picnic), Micha (dog owner, with dog Bolle).
- `/api/npc/chat` streams newline-delimited JSON: reply text as it arrives, then the validated reply, then updated memory.
- Qwen through the OpenAI-compatible API with streaming and JSON mode; default model `qwen-flash`. Without a key the same pipeline runs on a local mock.
- Guardrails in the prompt and in code: player text is delimited and sanitized, likely injections add a warning to the prompt, output is checked for prompt leaks and blocked topics (also mid-stream) and replaced by an in-character deflection.
- Replies are parsed tolerantly (code fences, truncated JSON, unknown emotions, actions the NPC lacks).
- Rate limit: 30 messages per player per hour plus a global daily cap, in memory for now (Supabase in M5), with a friendly in-game notice.
- Memory per player and NPC: last 12 messages plus a model-written summary every third turn; NPCs greet returning players by name.
- Chat panel (right on desktop, bottom sheet on mobile), conversation starters, emotion and action bubbles above NPCs, actions unlock experiences and can seat the player.
- 119 unit tests, 13 Playwright scenarios per viewport.

## M2: Görlitzer Park (done)

- Asset pipeline in TypeScript, one command: `pnpm assets:build`.
  - `fetch_lod2`: finds and downloads the 1 km LoD2 CityGML tiles covering each place.
  - `fetch_osm`: OSM XML via Overpass, falling back to the OSM API map endpoint.
  - `build_buildings`: streams CityGML, triangulates walls and roofs, bakes pastel vertex colors and a wall-layout attribute; OSM footprint extrusion as fallback (`--osm-buildings`).
  - `build_place`: ground with analytic terrain, green/water/path/road layers, mapped and scattered trees, benches, lamps; meshopt-compressed GLB plus JSON manifest.
- Görlitzer Park: 215 LoD2 buildings, 472 trees, 72 benches, the real path network and the park's central hollow. GLB 0.37 MB (target was under 5 MB).
- Runtime: procedural windows shader (lit at night), meadow shader, instanced trees with wind, benches, lamps with light pools, trimesh collision, invisible walls around the 300 m square.
- Day-night cycle (12 min per day): gradient sky with sun and stars, clouds, sun/moon light with player-following shadows, fog.
- Sitting on benches and picnic blankets (E or tap).
- Quality levels (low/medium/high) with device detection and automatic step-down on low frame rates.
- Loads in about 2.5 s locally. Screenshots in `docs/screenshots/`.

## M1: Avatar and movement (done)

- Procedural low-poly avatar from primitives with idle, walk, run, sit, wave and talk animation.
- Avatar editor at `/avatar`: name, build, skin tone, 8 hairstyles, hair color, top, bottoms, shoes, colors, randomize, rotatable live preview. Saved through a repository interface (localStorage for now).
- Third-person controller on Rapier's kinematic character controller: WASD/arrows, Shift to run, drag to orbit, wheel/pinch zoom, camera collision. Touch: virtual joystick plus drag.
- Title screen with a code-drawn skyline, German/English UI toggle.
- Playwright: creates an avatar and walks on desktop (keyboard) and mobile (joystick).

## M0: Foundation (done)

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, pnpm.
- ESLint + Prettier, Vitest, Playwright (desktop 1440x900 and mobile 390x844 projects, software WebGL).
- GitHub Actions: format check, lint, typecheck, unit tests, build, e2e.
- `/play` renders a placeholder 3D scene (ground, light, sky) through a client-only dynamic import.
- `lib/server/config.ts` reads env and decides mock/local modes; covered by unit tests.
