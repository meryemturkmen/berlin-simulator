# Progress log

Newest entry first.

## M7: Portfolio polish (done)

- README with hero screenshot, feature list, architecture diagram, stack, local start and licenses.
- `/about` in German and English with the Mermaid architecture diagram (library loaded on demand), data sources and repository link.
- `public/assets/LICENSES.md`.
- Lighthouse on the title page (production build, local): performance 99, accessibility 100, best practices 100, SEO 100.
- Final run: 152 unit tests, 22 Playwright scenarios on desktop and mobile, lint, typecheck and build all green.
- Still open on Mer's side: Supabase project, Qwen key, Vercel import (`docs/SETUP.md`). Until then the deployed app runs in mock mode with localStorage.

## Realism pass (done)

Requested after M6: a more realistic look. Filmic tone mapping, muted palettes, detailed procedural facades and ground surfaces, smoother trees, procedural clouds with haze, adult character proportions. Details in DECISIONS D24.

## M6: Atmosphere and experiences (done)

- Procedural ambient sound per place with the Web Audio API (no audio files): wind, leaves and birds in the park; murmur, cups and the S-Bahn overhead at the café; traffic hum and passing cars on the boulevard. Quiet by default, starts on the first user gesture, mute button in the HUD. The musician's song is a short plucked melody.
- Background pedestrians: instanced walkers strolling along footpaths that the pipeline extracts from OSM (five draw calls for the whole crowd, count depends on quality).
- Berlin album (key `B`): all 12 experiences grouped by place, with progress.
- Settings panel: language, sound, graphics quality (auto, low, medium, high), controls, links.
- Emotion and action bubbles above NPCs and quality levels were already done in M3 and M2.
- Sound was not auditioned by ear in the headless development environment: it is implemented and wired, but its mix should be checked on a real device.

## M5: Supabase (done, waiting for keys to go live)

- Migration `supabase/migrations/20261114000000_init.sql`: `profiles`, `experiences`, `npc_memories`, `rate_limits`, `global_usage`, RLS on all of them, policies scoped to `auth.uid()`, and the atomic `consume_chat_quota` function (service role only).
- Browser: anonymous sign-in on first use; a Supabase repository that mirrors every write to localStorage and falls back to it on errors, so the game also works offline or with a paused project.
- Server: bearer token verification, rate limiting through the database function (shared bucket for callers without an account, in-memory fallback during outages), NPC memory stored with the service role.
- No keys configured means localStorage and in-memory limits, automatically.
- Data access is tested against a fake Supabase HTTP API (19 tests); the migration is checked for RLS on every table.
- `docs/SETUP.md` has the click paths for Supabase, Qwen and Vercel.
- Not verified against a live project yet: that needs the keys.

## M4: Map, teleport, Mitte and Ku'damm (done)

- `scripts/build_map.ts`: district boundaries from the Geoportal Berlin WFS, simplified to 11 kB of SVG paths, with place markers.
- Map overlay (key `M` or button): districts, markers, place cards. Picking a place shows a loading screen with a Berlin fact, then the new scene. `?place=` deep links, last place is remembered.
- Hackescher Markt (Mitte): red-brick railway viaduct, Café Bogenlicht with a coffee counter, terrace tables with parasols, barista Noor (matcha or coffee lands in the inventory and in the player's hand), illustrator Henrik.
- Kurfürstendamm (Charlottenburg): Breitscheidplatz with the Memorial Church, boulevard, three invented shop fronts with lit windows at night, benches; shop assistant Carla, tourist Diego, lifelong local Herr Lehmann.
- Pipeline additions: building function codes drive landmark looks (church, station, canopies), shop fronts are snapped onto real walls, hand-placed benches join the instanced ones.
- Seats and benches can unlock experiences; 12 experiences across three places.
- 133 unit tests, 17 Playwright scenarios per viewport.

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
