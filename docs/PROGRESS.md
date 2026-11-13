# Progress log

Newest entry first.

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
