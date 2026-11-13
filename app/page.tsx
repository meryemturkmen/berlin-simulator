import Link from "next/link";

export default function TitlePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">
        Berlin Simulator
      </h1>
      <Link
        href="/play"
        className="bg-coral hover:bg-coral-deep rounded-full px-10 py-4 text-lg font-semibold text-white transition-colors"
      >
        Spielen
      </Link>
    </main>
  );
}
