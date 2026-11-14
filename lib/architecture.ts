/** Architecture overview as Mermaid source. Shown on /about and mirrored in the README. */
export const ARCHITECTURE_DIAGRAM = `flowchart LR
  subgraph Build["Asset pipeline (pnpm assets:build)"]
    LOD2["Geoportal Berlin<br/>LoD2 CityGML"] --> Pipeline["TypeScript scripts<br/>parse, triangulate, style"]
    OSM["OpenStreetMap"] --> Pipeline
    WFS["Geoportal Berlin<br/>district boundaries"] --> Pipeline
    Pipeline --> Assets["public/assets<br/>GLB + JSON per place, map"]
  end

  subgraph Browser
    UI["React UI<br/>title, editor, HUD, chat, map"]
    Game["React Three Fiber + Rapier<br/>scenes, player, NPCs"]
    Stores["Zustand stores"]
    Local[("localStorage")]
    UI <--> Stores
    Game <--> Stores
    Stores <--> Local
  end

  subgraph Vercel["Next.js on Vercel"]
    Static["Static pages and assets"]
    Chat["/api/npc/chat<br/>prompt, guardrails, rate limit"]
  end

  Assets --> Static --> Game
  Stores -- "message, streamed reply" --> Chat
  Chat -- "OpenAI-compatible, streaming" --> Qwen["Qwen<br/>Alibaba Cloud Model Studio"]
  Chat -- "service role" --> DB[("Supabase Postgres<br/>RLS on every table")]
  Stores -- "anonymous session" --> DB
`;
