"use client";

import dynamic from "next/dynamic";

// The game needs WebGL and browser APIs, so it is never rendered on the server.
const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <BootScreen />,
});

function BootScreen() {
  return (
    <div className="game-root bg-paper flex items-center justify-center">
      <p className="font-display text-ink-soft animate-pulse text-xl">Berlin Simulator</p>
    </div>
  );
}

export function GameLoader() {
  return <Game />;
}
