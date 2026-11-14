"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useSettings } from "@/game/store/settings";
import { ARCHITECTURE_DIAGRAM } from "@/lib/architecture";
import { useT } from "@/lib/i18n/useT";
import { Mermaid } from "./Mermaid";

export const REPOSITORY_URL = "https://github.com/meryemturkmen/berlin-simulator";

const STACK: [string, string][] = [
  ["Next.js 16, React 19, TypeScript", "App Router, strict mode"],
  ["three.js, React Three Fiber, drei", "rendering"],
  ["Rapier", "physics and character controller"],
  ["Zustand, Zod", "state and validation"],
  ["Tailwind CSS 4", "UI"],
  ["Qwen (Alibaba Cloud Model Studio)", "NPC dialogue, streamed"],
  ["Supabase", "Postgres, anonymous auth, row level security"],
  ["gltf-transform, meshoptimizer", "asset compression"],
  ["Vitest, Playwright, GitHub Actions", "tests and CI"],
];

const COPY = {
  de: {
    intro:
      "Ein gemütlicher Lifestyle-Simulator im heutigen Berlin, direkt im Browser. Du baust dir einen Avatar, reist über die Karte nach Mitte, Kreuzberg oder Charlottenburg, läufst herum und unterhältst dich frei mit den Leuten dort. Kein Kampf, keine Punkte: Du sammelst Erlebnisse.",
    howTitle: "Wie es gebaut ist",
    how: [
      "Die Stadt ist echt: Gebäude stammen aus dem amtlichen 3D-Modell Berlins (LoD2), Straßen, Wege, Bäume und Bänke aus OpenStreetMap. Ein Skript lädt die Daten, vereinfacht und färbt sie und schreibt pro Ort eine GLB-Datei von unter 0,5 MB.",
      "Nichts wurde von Hand modelliert. Fenster, Wiesen, Himmel, Figuren und Geräusche entstehen prozedural im Code.",
      "Die Menschen im Spiel werden von einem Sprachmodell (Qwen) gespielt. Jede Figur hat eine eigene Persönlichkeit, Ortswissen und Aktionen, die im Spiel etwas auslösen. Leitplanken im Prompt und im Code halten die Gespräche freundlich und in der Rolle. Ohne API-Schlüssel antwortet ein lokales Skript.",
    ],
    stackTitle: "Tech-Stack",
    architectureTitle: "Architektur",
    architectureLabel:
      "Architekturdiagramm: Asset-Pipeline, Browser, Next.js auf Vercel, Qwen und Supabase",
    dataTitle: "Daten und Lizenzen",
    data: [
      ["Gebäude", "Geoportal Berlin, 3D-Gebäudemodelle LoD2, Datenlizenz Deutschland Zero 2.0"],
      ["Bezirksgrenzen", "Geoportal Berlin, ALKIS Bezirke, Datenlizenz Deutschland Zero 2.0"],
      ["Straßen, Wege, Grün, Bäume, Bänke", "© OpenStreetMap-Mitwirkende, ODbL"],
      ["Figuren, Möbel, Klang", "prozedural im Quellcode, keine fremden Assets"],
      ["Schriften", "Fraunces und DM Sans, SIL Open Font License"],
    ],
    fiction: "Alle Personen, Cafés und Läden im Spiel sind erfunden.",
    repo: "Quellcode auf GitHub",
    play: "Spielen",
    back: "Zum Titelbildschirm",
  },
  en: {
    intro:
      "A cozy lifestyle simulator set in present-day Berlin, right in the browser. You build an avatar, travel across the map to Mitte, Kreuzberg or Charlottenburg, walk around and chat freely with the people there. No combat, no score: you collect experiences.",
    howTitle: "How it is built",
    how: [
      "The city is real: buildings come from Berlin's official 3D model (LoD2), streets, paths, trees and benches from OpenStreetMap. A script downloads the data, simplifies and colors it and writes one GLB file of under 0.5 MB per place.",
      "Nothing was modeled by hand. Windows, lawns, sky, characters and sound are all procedural code.",
      "The people in the game are played by a language model (Qwen). Every character has a personality, local knowledge and actions that change something in the game. Guardrails in the prompt and in code keep conversations friendly and in character. Without an API key a local script answers.",
    ],
    stackTitle: "Tech stack",
    architectureTitle: "Architecture",
    architectureLabel:
      "Architecture diagram: asset pipeline, browser, Next.js on Vercel, Qwen and Supabase",
    dataTitle: "Data and licenses",
    data: [
      ["Buildings", "Geoportal Berlin, 3D building models LoD2, Data licence Germany Zero 2.0"],
      ["District boundaries", "Geoportal Berlin, ALKIS districts, Data licence Germany Zero 2.0"],
      ["Streets, paths, green, trees, benches", "© OpenStreetMap contributors, ODbL"],
      ["Characters, furniture, sound", "procedural, defined in source code; no third-party assets"],
      ["Fonts", "Fraunces and DM Sans, SIL Open Font License"],
    ],
    fiction: "All people, cafés and shops in the game are invented.",
    repo: "Source code on GitHub",
    play: "Play",
    back: "Back to title screen",
  },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AboutContent() {
  useT();
  const language = useSettings((state) => state.language);
  const copy = COPY[language];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold underline-offset-4 hover:underline">
          ← {copy.back}
        </Link>
        <LanguageToggle />
      </div>

      <h1 className="font-display mt-10 text-5xl font-semibold tracking-tight sm:text-6xl">
        Berlin Simulator
      </h1>
      <p className="mt-5 text-xl leading-relaxed text-pretty">{copy.intro}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/play"
          className="bg-coral-deep rounded-full px-7 py-3 text-lg font-semibold text-white hover:opacity-90"
        >
          {copy.play}
        </Link>
        <a
          href={REPOSITORY_URL}
          className="border-ink/25 hover:bg-paper-dim rounded-full border bg-white px-7 py-3 text-lg font-semibold"
        >
          {copy.repo}
        </a>
      </div>

      <Section title={copy.howTitle}>
        <ul className="space-y-3 text-lg leading-relaxed">
          {copy.how.map((paragraph) => (
            <li key={paragraph} className="text-pretty">
              {paragraph}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={copy.architectureTitle}>
        <div className="border-ink/10 rounded-2xl border bg-white p-4">
          <Mermaid chart={ARCHITECTURE_DIAGRAM} label={copy.architectureLabel} />
        </div>
      </Section>

      <Section title={copy.stackTitle}>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {STACK.map(([name, purpose]) => (
            <div key={name} className="border-ink/10 border-b py-2">
              <dt className="font-semibold">{name}</dt>
              <dd className="text-ink-soft text-sm">{purpose}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={copy.dataTitle}>
        <dl className="space-y-3">
          {copy.data.map(([what, source]) => (
            <div key={what}>
              <dt className="font-semibold">{what}</dt>
              <dd className="text-ink-soft">{source}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5">{copy.fiction}</p>
        <p className="mt-2">
          <a href="/assets/LICENSES.md" className="font-semibold underline underline-offset-4">
            LICENSES.md
          </a>
        </p>
      </Section>
    </main>
  );
}
