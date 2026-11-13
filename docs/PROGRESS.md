# Progress log

Newest entry first.

## M0: Foundation (done)

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, pnpm.
- ESLint + Prettier, Vitest, Playwright (desktop 1440x900 and mobile 390x844 projects, software WebGL).
- GitHub Actions: format check, lint, typecheck, unit tests, build, e2e.
- `/play` renders a placeholder 3D scene (ground, light, sky) through a client-only dynamic import.
- `lib/server/config.ts` reads env and decides mock/local modes; covered by unit tests.
