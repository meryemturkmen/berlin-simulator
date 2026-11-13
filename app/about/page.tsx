import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About · Berlin Simulator" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold">Berlin Simulator</h1>
      <p className="text-ink-soft mt-4 text-lg">Work in progress.</p>
      <Link href="/" className="mt-8 inline-block font-semibold underline underline-offset-4">
        ← Back
      </Link>
    </main>
  );
}
