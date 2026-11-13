# Decisions

Short log of technical decisions. Newest last.

## D1: Next.js 16 with Cache Components

`create-next-app` scaffolds Next.js 16 with `cacheComponents` and `partialPrefetching` enabled. We keep those defaults. The game itself is a client-only tree mounted behind a dynamic import with `ssr: false`, so the server only renders the static shell.

## D2: Asset pipeline in Node (TypeScript via tsx)

One language for app and pipeline, and gltf-transform is a Node library anyway. No Python needed.

## D3: Playwright pinned to the locally installed browser build

`@playwright/test` is pinned to 1.63.0 so it matches the Chromium build available in the development container. CI installs the matching browser with `playwright install`.
