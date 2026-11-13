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

## D7: OSM data source

The fetch script tries Overpass (overpass-api.de, then a mirror) and falls back to the main OSM API's `/api/0.6/map` endpoint, which serves the same data for small bounding boxes. All three return OSM XML, so there is one parser. In the development container Overpass was unreachable and the fallback was used.

## D8: Ground layers as flat decals

Green areas, paths, roads and markings are separate meshes a few centimeters above the ground that do not write depth and are drawn in a fixed order. This avoids polygon boolean operations in the pipeline and z-fighting at runtime. Where a place has terrain, ground and layers are subdivided to 3 m only around the bumps.

## D9: Procedural windows from a vertex attribute

Buildings ship without textures or normals. The pipeline stores, per wall vertex, the distance along the wall, the height, the wall width and the wall top. The fragment shader derives evenly spaced windows, shop-height ground floors and randomly lit windows at night from that. One draw call for all buildings of a place.

## D10: No tone mapping

Colors are authored as a pastel palette. The renderer runs without tone mapping (`flat`) and light intensities are tuned so sunlit surfaces land near their palette color.

## D11: Quality levels pulled forward from M6

Software renderers (CI, some VMs) and weak phones need a cheaper mode to stay responsive, so the low/medium/high levels with auto-detection were built in M2. A manual override is stored in settings; its UI follows in M6.

## D12: Default model `qwen-flash`

Model Studio lists `qwen-flash`, `qwen-turbo` and `qwen-plus` for the international region. `qwen-flash` is the fast, low-cost tier and is enough for one-to-four-sentence small talk, so it is the default. `QWEN_MODEL` overrides it. The official pricing page could not be opened from the development container (host not allowlisted), so prices were not verified first-hand; check them in the console before going public.

## D13: Plain fetch instead of the OpenAI SDK

The chat needs two calls (streamed completion, short non-streamed completion). A 90-line fetch client against the OpenAI-compatible endpoint covers that, keeps the server bundle small and is easy to fake in tests. Thinking is switched off and JSON mode switched on; if a model rejects those parameters the request is retried once without them.

## D14: Chat transport and streaming of structured replies

The model must answer with JSON, but players should see text appear as it is generated. The server extracts the `reply` string from the partial JSON while it streams and forwards only that text. The final event carries the validated reply and replaces whatever was streamed, so a guardrail hit can still swap the text.

## D15: Where NPC memory lives

Without Supabase the browser holds the memory (localStorage) and sends it with each turn; the server validates and bounds it. With Supabase (M5) the server loads and stores memory itself and ignores the client copy.
