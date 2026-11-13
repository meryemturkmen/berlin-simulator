# Decisions

Short log of technical decisions. Newest last.

## D1: Next.js 16 with Cache Components

`create-next-app` scaffolds Next.js 16 with `cacheComponents` and `partialPrefetching` enabled. We keep those defaults. The game itself is a client-only tree mounted behind a dynamic import with `ssr: false`, so the server only renders the static shell.

## D2: Asset pipeline in Node (TypeScript via tsx)

One language for app and pipeline, and gltf-transform is a Node library anyway. No Python needed.

## D3: Playwright pinned to the locally installed browser build

`@playwright/test` is pinned to 1.63.0 so it matches the Chromium build available in the development container. CI installs the matching browser with `playwright install`.

## D4: Procedural avatar instead of a CC0 character pack

The brief prefers a rigged CC0 pack (Kenney, Quaternius). Kenney's site rejects scripted downloads (HTTP 403 for non-browser clients) and Quaternius packs are distributed through Google Drive and itch.io, which need a manual click-through. Neither can be fetched reproducibly by a script, so the documented fallback applies: a procedural low-poly avatar built from primitives. Side benefits: every editor option (build, hairstyle, clothing type, colors) is a parameter rather than a mesh swap, the same model drives player, NPCs and editor preview, and it adds zero bytes of download.

## D5: German and English UI

The UI ships in German and English with a toggle. The default follows the browser language. NPCs answer in whatever language the player writes in, independent of the UI language.

## D6: LoD2 license

The ATOM feed of the Berlin LoD2 dataset states "Datenlizenz Deutschland - Zero - Version 2.0" (dl-de/zero-2-0), not the attribution license the brief assumed. No attribution is legally required; we credit Geoportal Berlin anyway.
