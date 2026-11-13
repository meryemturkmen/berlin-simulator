# Progress log

Newest entry first.

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
