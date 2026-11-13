import type { Metadata } from "next";
import { GameLoader } from "@/game/GameLoader";

export const metadata: Metadata = { title: "Play · Berlin Simulator" };

export default function PlayPage() {
  return <GameLoader />;
}
